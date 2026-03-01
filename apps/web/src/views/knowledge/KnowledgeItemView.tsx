import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { TbArrowLeft, TbBrandInstagram, TbBrandLinkedin, TbBrandTiktok, TbBrandX, TbBrandYoutube, TbDownload, TbExternalLink, TbFile, TbMusic, TbPhoto, TbUser, TbVideo } from "react-icons/tb";

import Badge from "~/components/Badge";
import LabelIcon from "~/components/LabelIcon";
import { PageHead } from "~/components/PageHead";
import { api, apiKeys } from "~/utils/api";

const typeIcons: Record<string, React.ReactNode> = {
  link: <TbExternalLink className="h-5 w-5" />,
  creator: <TbUser className="h-5 w-5" />,
  tweet: <TbBrandX className="h-5 w-5" />,
  instagram: <TbBrandInstagram className="h-5 w-5" />,
  tiktok: <TbBrandTiktok className="h-5 w-5" />,
  youtube: <TbBrandYoutube className="h-5 w-5" />,
  linkedin: <TbBrandLinkedin className="h-5 w-5" />,
  image: <TbPhoto className="h-5 w-5" />,
  video: <TbVideo className="h-5 w-5" />,
  pdf: <TbFile className="h-5 w-5" />,
  audio: <TbMusic className="h-5 w-5" />,
  other: <TbFile className="h-5 w-5" />,
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

export default function KnowledgeItemView() {
  const { publicId } = useParams({ strict: false }) as { publicId: string };

  const { data: item, isLoading } = useQuery({
    queryKey: apiKeys.knowledgeItem.byId({ publicId }),
    queryFn: () => api.knowledgeItem.byId({ publicId }),
    enabled: publicId?.length >= 12,
  });

  if (isLoading) {
    return (
      <div className="m-auto max-w-[1100px] p-6 px-5 md:px-28 md:py-12">
        <div className="text-sm text-neutral-500 dark:text-dark-800">Loading...</div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="m-auto max-w-[1100px] p-6 px-5 md:px-28 md:py-12">
        <div className="text-sm text-neutral-500 dark:text-dark-800">Item not found.</div>
      </div>
    );
  }

  return (
    <>
      <PageHead title={item.title} />
      <div className="m-auto max-w-[1100px] p-6 px-5 md:px-28 md:py-12">
        <Link
          to="/knowledge"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 dark:text-dark-800 dark:hover:text-dark-1000"
        >
          <TbArrowLeft className="h-4 w-4" />
          Back to Knowledge Base
        </Link>

        <div className="mt-4 rounded-lg border border-light-300 bg-white p-6 dark:border-dark-300 dark:bg-dark-200">
          <div className="flex items-start gap-4">
            <span className="mt-0.5 text-neutral-500 dark:text-dark-800">
              {typeIcons[item.type] ?? typeIcons.other}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-neutral-900 dark:text-dark-1000">
                {item.title}
              </h1>
              <span className="mt-1 inline-block rounded-full bg-light-200 px-2 py-0.5 text-xs text-neutral-600 dark:bg-dark-400 dark:text-dark-900">
                {typeLabels[item.type] ?? "Other"}
              </span>
            </div>
          </div>

          {item.description && (
            <p className="mt-4 text-sm text-neutral-600 dark:text-dark-900">
              {item.description}
            </p>
          )}

          {item.fileUrl && item.type === "image" && (
            <div className="mt-4 overflow-hidden rounded-lg">
              <img
                src={item.fileUrl}
                alt={item.title}
                className="max-h-96 w-full object-contain"
              />
            </div>
          )}

          {item.fileUrl && item.type === "video" && (
            <div className="mt-4 overflow-hidden rounded-lg">
              <video
                src={item.fileUrl}
                controls
                className="max-h-96 w-full"
              />
            </div>
          )}

          {item.fileUrl && item.type === "audio" && (
            <div className="mt-4">
              <audio src={item.fileUrl} controls className="w-full" />
            </div>
          )}

          {item.fileUrl && !["image", "video", "audio"].includes(item.type) && (
            <a
              href={item.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 dark:text-dark-800 dark:hover:text-dark-1000"
            >
              <TbDownload className="h-4 w-4" />
              Download file
            </a>
          )}

          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 dark:text-dark-800 dark:hover:text-dark-1000"
            >
              <TbExternalLink className="h-4 w-4" />
              {item.url}
            </a>
          )}

          {item.labels.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {item.labels.map((l) => (
                <Badge
                  key={l.knowledgeLabel.publicId}
                  value={l.knowledgeLabel.name}
                  iconLeft={<LabelIcon colourCode={l.knowledgeLabel.colourCode} />}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
