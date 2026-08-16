import type {
  KnowledgeAnnotation,
  KnowledgeAnnotationSelection,
} from "./knowledge-annotations";

export function reanchorKnowledgeAnnotation(
  annotation: KnowledgeAnnotation,
  selection: KnowledgeAnnotationSelection,
  updatedAt: string,
): KnowledgeAnnotation {
  return {
    ...annotation,
    ...selection,
    updatedAt,
  };
}
