import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { HiXMark } from "react-icons/hi2";
import { TbUpload } from "react-icons/tb";
import { z } from "zod";
import Button from "~/components/Button";
import CheckboxDropdown from "~/components/CheckboxDropdown";
import Input from "~/components/Input";
import LabelIcon from "~/components/LabelIcon";
import { useModal } from "~/providers/modal";
import { usePopup } from "~/providers/popup";
import { api, apiKeys } from "~/utils/api";

const resourceItemTypes = [
  "link",
  "creator",
  "tweet",
  "instagram",
  "tiktok",
  "youtube",
  "linkedin",
  "image",
  "video",
  "pdf",
  "audio",
  "other",
] as const;

const FILE_TYPES = new Set(["image", "video", "pdf", "audio"]);

const ACCEPT_BY_TYPE: Record<string, string> = {
  image: "image/*",
  video: "video/*",
  audio: "audio/*",
  pdf: "application/pdf",
};

const schema = z.object({
  title: z
    .string()
    .min(1, { message: "Title is required" })
    .max(255, { message: "Title cannot exceed 255 characters" }),
  type: z.enum(resourceItemTypes),
  url: z.string().optional(),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function EditResourceItemForm({
  publicId,
}: {
  publicId: string;
}) {
  const queryClient = useQueryClient();
  const { closeModal, openModal, modalStates, clearModalState } = useModal();
  const { showPopup } = usePopup();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: item } = useQuery({
    queryKey: apiKeys.resourceItem.byId({ publicId }),
    queryFn: () => api.resourceItem.byId({ publicId }),
  });

  const { data: allLabels } = useQuery({
    queryKey: apiKeys.resourceLabel.all(),
    queryFn: () => api.resourceLabel.all(),
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: item
      ? {
          title: item.title,
          type: item.type,
          url: item.url ?? "",
          description: item.description ?? "",
        }
      : undefined,
  });

  const selectedType = watch("type");
  const isFileType = FILE_TYPES.has(selectedType);

  const itemLabelPublicIds =
    item?.labels.map((l) => l.resourceLabel.publicId) ?? [];

  const updateItem = useMutation({
    mutationFn: api.resourceItem.update,
    onSuccess: async () => {
      closeModal();
      await queryClient.refetchQueries({
        queryKey: apiKeys.resourceItem.all(),
      });
    },
    onError: () => {
      showPopup({
        header: "Error",
        message: "Failed to update resource",
        icon: "error",
      });
    },
  });

  const deleteItem = useMutation({
    mutationFn: api.resourceItem.delete,
    onSuccess: async () => {
      closeModal();
      await queryClient.refetchQueries({
        queryKey: apiKeys.resourceItem.all(),
      });
    },
    onError: () => {
      showPopup({
        header: "Error",
        message: "Failed to delete resource",
        icon: "error",
      });
    },
  });

  const toggleLabelMutation = useMutation({
    mutationFn: api.resourceItem.toggleLabel,
    onSuccess: async () => {
      await queryClient.refetchQueries({
        queryKey: apiKeys.resourceItem.byId({ publicId }),
      });
      await queryClient.refetchQueries({
        queryKey: apiKeys.resourceItem.all(),
      });
    },
  });

  const handleToggleLabel = (labelPublicId: string) => {
    toggleLabelMutation.mutate({ publicId, labelPublicId });
  };

  const formattedLabels =
    allLabels?.map((label) => ({
      key: label.publicId,
      value: label.name,
      leftIcon: <LabelIcon colourCode={label.colourCode} />,
      selected: itemLabelPublicIds.includes(label.publicId),
    })) ?? [];

  useEffect(() => {
    const newLabelId = modalStates.NEW_RESOURCE_LABEL_CREATED;
    if (!newLabelId) return;
    toggleLabelMutation.mutate({ publicId, labelPublicId: newLabelId });
    clearModalState("NEW_RESOURCE_LABEL_CREATED");
  }, [modalStates.NEW_RESOURCE_LABEL_CREATED]);

  const onSubmit = async (data: FormValues) => {
    const isFile = FILE_TYPES.has(data.type);

    if (isFile && selectedFile) {
      setIsUploading(true);
      try {
        const { uploadUrl, fileKey } = await api.upload.presign({
          fileName: selectedFile.name,
          mimeType: selectedFile.type,
          fileSize: selectedFile.size,
        });
        await api.upload.toR2(uploadUrl, selectedFile);
        updateItem.mutate({
          publicId,
          title: data.title,
          type: data.type,
          description: data.description || null,
          fileKey,
          fileSize: selectedFile.size,
          mimeType: selectedFile.type,
        });
      } catch {
        showPopup({
          header: "Error",
          message: "Failed to upload file",
          icon: "error",
        });
      } finally {
        setIsUploading(false);
      }
      return;
    }

    updateItem.mutate({
      publicId,
      title: data.title,
      type: data.type,
      url: isFile ? null : (data.url || null),
      description: data.description || null,
    });
  };

  if (!item) return <div className="h-[340px]" />;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="px-5 pt-5">
        <div className="flex w-full items-center justify-between pb-4 text-neutral-900 dark:text-dark-1000">
          <h2 className="text-sm font-bold">Edit Resource</h2>
          <button
            type="button"
            className="rounded p-1 hover:bg-light-300 focus:outline-none dark:hover:bg-dark-300"
            onClick={(e) => {
              e.preventDefault();
              closeModal();
            }}
          >
            <HiXMark size={18} className="text-light-900 dark:text-dark-900" />
          </button>
        </div>
        <div className="space-y-3">
          <Input
            id="edit-title"
            placeholder="Title"
            {...register("title", { required: true })}
            errorMessage={errors.title?.message}
            onKeyDown={async (e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                await handleSubmit(onSubmit)();
              }
            }}
          />
          <select
            {...register("type")}
            className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-sm shadow-sm ring-1 ring-inset ring-light-600 focus:ring-2 focus:ring-inset focus:ring-light-700 dark:bg-dark-300 dark:text-dark-1000 dark:ring-dark-700 dark:focus:ring-dark-700 sm:leading-6"
          >
            {resourceItemTypes.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
          {isFileType ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_BY_TYPE[selectedType] ?? "*/*"}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setSelectedFile(file);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm ring-1 ring-inset ring-light-600 hover:bg-light-200 dark:ring-dark-700 dark:hover:bg-dark-300"
              >
                <TbUpload className="h-4 w-4 text-neutral-500 dark:text-dark-800" />
                <span className="truncate text-neutral-600 dark:text-dark-900">
                  {selectedFile
                    ? selectedFile.name
                    : item?.fileKey
                      ? "Replace file..."
                      : "Choose file..."}
                </span>
              </button>
            </div>
          ) : (
            <Input
              id="edit-url"
              placeholder={selectedType === "creator" ? "Profile URL (optional)" : "URL (optional)"}
              {...register("url")}
            />
          )}
          <Input
            id="edit-description"
            placeholder="Description (optional)"
            {...register("description")}
          />
          <div className="w-fit">
            <CheckboxDropdown
              items={formattedLabels}
              handleSelect={(_groupKey, item) => handleToggleLabel(item.key)}
              handleCreate={() => openModal("NEW_RESOURCE_LABEL")}
              createNewItemLabel="Create new label"
            >
              <div className="flex h-full w-full items-center rounded-[5px] border-[1px] border-light-600 bg-light-200 px-2 py-1 text-left text-xs text-light-800 hover:bg-light-300 dark:border-dark-600 dark:bg-dark-400 dark:text-dark-1000 dark:hover:bg-dark-500">
                {!itemLabelPublicIds.length ? (
                  "Labels"
                ) : (
                  <>
                    <div
                      className={
                        itemLabelPublicIds.length > 1
                          ? "flex -space-x-[2px] overflow-hidden"
                          : "flex items-center"
                      }
                    >
                      {itemLabelPublicIds.map((labelPublicId) => {
                        const label = allLabels?.find(
                          (l) => l.publicId === labelPublicId,
                        );
                        return (
                          <span key={labelPublicId} className="flex items-center">
                            <svg
                              fill={label?.colourCode ?? "#3730a3"}
                              className="h-2 w-2"
                              viewBox="0 0 6 6"
                              aria-hidden="true"
                            >
                              <circle cx={3} cy={3} r={3} />
                            </svg>
                            {itemLabelPublicIds.length === 1 && (
                              <span className="ml-1">{label?.name}</span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                    {itemLabelPublicIds.length > 1 && (
                      <span className="ml-1">
                        {`${itemLabelPublicIds.length} labels`}
                      </span>
                    )}
                  </>
                )}
              </div>
            </CheckboxDropdown>
          </div>
        </div>
      </div>
      <div className="mt-6 flex items-center justify-end border-t border-light-600 px-5 pb-5 pt-5 dark:border-dark-600">
        <div className="mr-auto">
          <Button
            type="button"
            variant="secondary"
            onClick={() => deleteItem.mutate({ publicId })}
            isLoading={deleteItem.isPending}
          >
            Delete
          </Button>
        </div>
        <Button type="submit" isLoading={updateItem.isPending || isUploading}>
          {isUploading ? "Uploading..." : "Save"}
        </Button>
      </div>
    </form>
  );
}
