import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { HiOutlinePlusSmall } from "react-icons/hi2";
import { TbArrowUpRight, TbBrandInstagram, TbBrandLinkedin, TbBrandTiktok, TbBrandX, TbBrandYoutube, TbExternalLink, TbFile, TbMusic, TbPhoto, TbUser, TbVideo } from "react-icons/tb";

import Badge from "~/components/Badge";
import Button from "~/components/Button";
import LabelIcon from "~/components/LabelIcon";
import Modal from "~/components/modal";
import { PageHead } from "~/components/PageHead";
import { useModal } from "~/providers/modal";
import { api, apiKeys } from "~/utils/api";
import { EditKnowledgeItemForm } from "./components/EditKnowledgeItemForm";
import { KnowledgeLabelForm } from "./components/KnowledgeLabelForm";
import { NewKnowledgeItemForm } from "./components/NewKnowledgeItemForm";

const typeIcons: Record<string, React.ReactNode> = {
  link: <TbExternalLink className="h-4 w-4" />,
  creator: <TbUser className="h-4 w-4" />,
  tweet: <TbBrandX className="h-4 w-4" />,
  instagram: <TbBrandInstagram className="h-4 w-4" />,
  tiktok: <TbBrandTiktok className="h-4 w-4" />,
  youtube: <TbBrandYoutube className="h-4 w-4" />,
  linkedin: <TbBrandLinkedin className="h-4 w-4" />,
  image: <TbPhoto className="h-4 w-4" />,
  video: <TbVideo className="h-4 w-4" />,
  pdf: <TbFile className="h-4 w-4" />,
  audio: <TbMusic className="h-4 w-4" />,
  other: <TbFile className="h-4 w-4" />,
};

const typeLabels: Record<string, string> = {
  link: "Link",
  creator: "Creator",
  tweet: "Tweet",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  image: "Image",
  video: "Video",
  pdf: "PDF",
  audio: "Audio",
  other: "Other",
};

const allTypes = Object.keys(typeLabels);

export default function KnowledgeView() {
  const { openModal, modalContentType, isOpen, entityId, isInStack } = useModal();
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const { data: items, isLoading } = useQuery({
    queryKey: apiKeys.knowledgeItem.all(),
    queryFn: () => api.knowledgeItem.all(),
  });
  const { data: labels } = useQuery({
    queryKey: apiKeys.knowledgeLabel.all(),
    queryFn: () => api.knowledgeLabel.all(),
  });

  const toggleLabel = (publicId: string) => {
    setSelectedLabelIds((prev) => {
      const next = new Set(prev);
      if (next.has(publicId)) next.delete(publicId);
      else next.add(publicId);
      return next;
    });
  };

  const toggleType = (type: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const filteredItems = items?.filter((item) => {
    const matchesLabel = selectedLabelIds.size === 0 || item.labels.some((l) => selectedLabelIds.has(l.knowledgeLabel.publicId));
    const matchesType = selectedTypes.size === 0 || selectedTypes.has(item.type);
    return matchesLabel && matchesType;
  });

  return (
    <>
      <PageHead title="Knowledge Base" />
      <div className="m-auto h-full max-w-[1100px] p-6 px-5 md:px-28 md:py-12">
        <div className="relative z-10 mb-8 flex w-full items-center justify-between">
          <h1 className="font-bold tracking-tight text-neutral-900 dark:text-dark-1000 sm:text-[1.2rem]">
            Knowledge Base
          </h1>
          <Button
            type="button"
            variant="primary"
            onClick={() => openModal("NEW_KNOWLEDGE_ITEM")}
            iconLeft={
              <HiOutlinePlusSmall aria-hidden="true" className="h-4 w-4" />
            }
          >
            New
          </Button>
        </div>

        <Modal
          modalSize="sm"
          isVisible={isOpen && isInStack("NEW_KNOWLEDGE_ITEM")}
        >
          <NewKnowledgeItemForm />
        </Modal>

        <Modal
          modalSize="sm"
          isVisible={isOpen && modalContentType === "NEW_KNOWLEDGE_LABEL"}
        >
          <KnowledgeLabelForm />
        </Modal>

        <Modal
          modalSize="sm"
          isVisible={isOpen && modalContentType === "EDIT_KNOWLEDGE_ITEM"}
        >
          {entityId && <EditKnowledgeItemForm publicId={entityId} />}
        </Modal>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {allTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => toggleType(type)}
              className={`inline-flex items-center gap-x-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedTypes.has(type)
                  ? "bg-neutral-900 text-white ring-1 ring-neutral-900 dark:bg-dark-900 dark:text-dark-100 dark:ring-dark-900"
                  : "text-neutral-600 ring-1 ring-inset ring-light-600 hover:bg-light-200 dark:text-dark-1000 dark:ring-dark-800 dark:hover:bg-dark-300"
              }`}
            >
              {typeIcons[type]}
              {typeLabels[type]}
            </button>
          ))}
        </div>

        {labels && labels.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {labels.map((label) => (
              <button
                key={label.publicId}
                type="button"
                onClick={() => toggleLabel(label.publicId)}
                className={`inline-flex items-center gap-x-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedLabelIds.has(label.publicId)
                    ? "bg-neutral-900 text-white ring-1 ring-neutral-900 dark:bg-dark-900 dark:text-dark-100 dark:ring-dark-900"
                    : "text-neutral-600 ring-1 ring-inset ring-light-600 hover:bg-light-200 dark:text-dark-1000 dark:ring-dark-800 dark:hover:bg-dark-300"
                }`}
              >
                <LabelIcon colourCode={label.colourCode} />
                {label.name}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="text-sm text-neutral-500 dark:text-dark-800">
            Loading...
          </div>
        ) : !filteredItems?.length ? (
          <div className="text-sm text-neutral-500 dark:text-dark-800">
            {items?.length ? "No items match the selected filters." : "No items yet. Add your first knowledge item to get started."}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <button
                type="button"
                key={item.publicId}
                onClick={() =>
                  openModal("EDIT_KNOWLEDGE_ITEM", item.publicId)
                }
                className="flex flex-col rounded-lg border border-light-300 bg-white p-4 text-left transition-colors hover:border-light-600 dark:border-dark-300 dark:bg-dark-200 dark:hover:border-dark-500"
              >
                <div className="mb-3 flex w-full items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-light-200 px-2 py-0.5 text-xs text-neutral-600 dark:bg-dark-400 dark:text-dark-900">
                    {typeIcons[item.type] ?? typeIcons.other}
                    {typeLabels[item.type] ?? "Other"}
                  </span>
                  <div className="flex items-center gap-0.5">
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 rounded p-1 text-neutral-400 hover:bg-light-200 hover:text-neutral-600 dark:text-dark-700 dark:hover:bg-dark-400 dark:hover:text-dark-900"
                      >
                        <TbExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <Link
                      to="/knowledge/$publicId"
                      params={{ publicId: item.publicId }}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 rounded p-1 text-neutral-400 hover:bg-light-200 hover:text-neutral-600 dark:text-dark-700 dark:hover:bg-dark-400 dark:hover:text-dark-900"
                    >
                      <TbArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
                <p className="truncate text-sm font-medium text-neutral-900 dark:text-dark-1000">
                  {item.title}
                </p>
                {item.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-neutral-500 dark:text-dark-800">
                    {item.description}
                  </p>
                )}
                {item.labels.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1 overflow-hidden">
                    {item.labels.map((l) => (
                      <Badge
                        key={l.knowledgeLabel.publicId}
                        value={l.knowledgeLabel.name}
                        iconLeft={
                          <LabelIcon
                            colourCode={l.knowledgeLabel.colourCode}
                          />
                        }
                      />
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
