import { createFileRoute } from "@tanstack/react-router";
import { getDashboardLayout } from "~/components/Dashboard";
import KnowledgeItemView from "~/views/knowledge/KnowledgeItemView";

export const Route = createFileRoute("/knowledge/$publicId")({
  component: KnowledgeItemPage,
});

function KnowledgeItemPage() {
  return getDashboardLayout(<KnowledgeItemView />);
}
