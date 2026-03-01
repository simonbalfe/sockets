import { createFileRoute } from "@tanstack/react-router";
import { getDashboardLayout } from "~/components/Dashboard";
import ResourceItemView from "~/views/resources/ResourceItemView";

export const Route = createFileRoute("/resources/$publicId")({
  component: ResourceItemPage,
});

function ResourceItemPage() {
  return getDashboardLayout(<ResourceItemView />);
}
