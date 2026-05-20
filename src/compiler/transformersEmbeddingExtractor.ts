import os from "node:os";
import path from "node:path";
import type { CommandExtractor, CommandIRCandidate } from "./extractors.js";
import { buildMetadataDocs } from "../metadata/loadSkillMetadata.js";
import type { MetadataDoc } from "../metadata/schema.js";

const DEFAULT_MODEL = "Xenova/all-MiniLM-L6-v2";
const DEFAULT_THRESHOLD = 0.58;
const DEFAULT_TOP_K = 5;

interface EmbeddedMetadataDoc {
  doc: MetadataDoc;
  embedding: Float32Array;
}

interface EmbeddingCache {
  signature: string;
  model: string;
  docs: EmbeddedMetadataDoc[];
}

type FeatureExtractionPipeline = (text: string, options: { pooling: "mean"; normalize: boolean }) => Promise<{ data: Float32Array | number[] }>;

let extractorPromise: Promise<FeatureExtractionPipeline> | undefined;
let metadataCache: EmbeddingCache | undefined;
let warned = false;

function embeddingsEnabled(): boolean {
  return process.env.PIG_COMMAND_COMPILER_EMBEDDINGS !== "0" && process.env.PIG_COMMAND_COMPILER_EMBEDDINGS !== "false";
}

function embeddingModel(): string {
  return process.env.PIG_COMMAND_COMPILER_EMBEDDING_MODEL || DEFAULT_MODEL;
}

function embeddingThreshold(): number {
  const raw = Number(process.env.PIG_COMMAND_COMPILER_EMBEDDING_THRESHOLD);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_THRESHOLD;
}

function embeddingTopK(): number {
  const raw = Number(process.env.PIG_COMMAND_COMPILER_EMBEDDING_TOP_K);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_TOP_K;
}

async function getFeatureExtractor(model: string): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const transformers = await import("@huggingface/transformers");
      transformers.env.cacheDir = process.env.TRANSFORMERS_CACHE || path.join(os.homedir(), ".cache", "pig-command-compiler", "transformers");
      const pipe = await transformers.pipeline("feature-extraction", model);
      return pipe as unknown as FeatureExtractionPipeline;
    })();
  }
  return extractorPromise;
}

async function embedText(text: string, model: string): Promise<Float32Array> {
  const extractor = await getFeatureExtractor(model);
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return output.data instanceof Float32Array ? output.data : Float32Array.from(output.data);
}

function catalogSignature(docs: MetadataDoc[]): string {
  return JSON.stringify(docs.map((doc) => [doc.id, doc.text, doc.ir]));
}

async function getEmbeddedMetadataDocs(resourcesCatalog: Parameters<typeof buildMetadataDocs>[0], model: string): Promise<EmbeddedMetadataDoc[]> {
  const docs = buildMetadataDocs(resourcesCatalog);
  const signature = catalogSignature(docs);
  if (metadataCache?.signature === signature && metadataCache.model === model) return metadataCache.docs;

  const embedded = await Promise.all(docs.map(async (doc) => ({
    doc,
    embedding: await embedText(doc.text, model),
  })));
  metadataCache = { signature, model, docs: embedded };
  return embedded;
}

function dot(a: Float32Array, b: Float32Array): number {
  const length = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < length; i++) sum += a[i] * b[i];
  return sum;
}

function hasNegative(text: string, negatives: string[]): boolean {
  const lower = text.toLowerCase();
  return negatives.some((negative) => lower.includes(negative.toLowerCase()));
}

export const transformersEmbeddingExtractor: CommandExtractor = {
  name: "transformers-embedding",

  async extract(text, resources): Promise<CommandIRCandidate[]> {
    if (!embeddingsEnabled()) return [];

    try {
      const model = embeddingModel();
      const queryEmbedding = await embedText(text, model);
      const docs = await getEmbeddedMetadataDocs(resources.catalog, model);
      const threshold = embeddingThreshold();

      return docs
        .filter(({ doc }) => !hasNegative(text, doc.negativeExamples))
        .map(({ doc, embedding }) => ({ doc, score: dot(queryEmbedding, embedding) }))
        .filter(({ score }) => score >= threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, embeddingTopK())
        .map(({ doc, score }) => ({
          ir: { ...doc.ir, kind: "command", confidence: Math.min(0.87, Math.max(0.6, score)) },
          extractor: "transformers-embedding",
          matchedTerms: doc.terms.slice(0, 5),
          reason: `semantic match ${doc.id} score=${score.toFixed(3)}`,
          evidence: { kind: "semantic", score, tokenMatches: text.toLowerCase().match(/[a-z0-9']+/g) ?? [] },
        }));
    } catch (error) {
      if (!warned) {
        warned = true;
        console.warn(`[pig-command-compiler] transformers embedding extractor disabled after error: ${(error as Error).message}`);
      }
      return [];
    }
  },
};
