import { redirect } from "next/navigation";

export default function ProjectFilesPreviewPage(): never {
  redirect("/prototype/desktop?section=files");
}
