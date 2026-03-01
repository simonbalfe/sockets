import { createFileRoute } from "@tanstack/react-router";
import { getDashboardLayout } from "~/components/Dashboard";
import ResourcesView from "~/views/resources";

export const Route = createFileRoute("/resources/")({
  component: ResourcesPage,
});

function ResourcesPage() {
  return getDashboardLayout(<ResourcesView />);
}
