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
import { detectTypeFromUrl, detectTypeFromMime } from "~/utils/detect-resource-type";

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
  "app",
  "other",
] as const;

const FILE_TYPES = new Set(["image", "video", "pdf", "audio"]);

const schema = z.object({
  title: z
    .string()
    .min(1, { message: "Title is required" })
    .max(255, { message: "Title cannot exceed 255 characters" }),
  type: z.enum(resourceItemTypes),
  url: z.string().optional(),
  description: z.string().optional(),
  labelPublicIds: z.array(z.string()).default([]),
});

type FormValues = z.infer<typeof schema>;

export function NewResourceItemForm() {
  const queryClient = useQueryClient();
  const { closeModal, openModal, modalStates, clearModalState } = useModal();
  const { showPopup } = usePopup();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      type: "link",
      url: "",
      description: "",
      labelPublicIds: [],
    },
  });

  const selectedType = watch("type");
  const isFileType = FILE_TYPES.has(selectedType);
  const selectedLabelPublicIds = watch("labelPublicIds", []);
  const [mode, setMode] = useState<"url" | "file">("url");

  const { data: allLabels } = useQuery({
    queryKey: apiKeys.resourceLabel.all(),
    queryFn: () => api.resourceLabel.all(),
  });

  const toggleLabelMutation = useMutation({
    mutationFn: api.resourceItem.toggleLabel,
  });

  const createItem = useMutation({
    mutationFn: api.resourceItem.create,
    onSuccess: async (result) => {
      for (const labelPublicId of selectedLabelPublicIds) {
        await toggleLabelMutation.mutateAsync({
          publicId: result.publicId,
          labelPublicId,
        });
      }
      closeModal();
      await queryClient.refetchQueries({
        queryKey: apiKeys.resourceItem.all(),
      });
    },
    onError: () => {
      showPopup({
        header: "Error",
        message: "Failed to create resource",
        icon: "error",
      });
    },
  });

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
        createItem.mutate({
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

    createItem.mutate({
      title: data.title,
      type: data.type,
      url: data.url || null,
      description: data.description || null,
    });
  };

  const handleSelectLabel = (labelPublicId: string) => {
    const currentIndex = selectedLabelPublicIds.indexOf(labelPublicId);
    if (currentIndex === -1) {
      setValue("labelPublicIds", [...selectedLabelPublicIds, labelPublicId]);
    } else {
      const next = [...selectedLabelPublicIds];
      next.splice(currentIndex, 1);
      setValue("labelPublicIds", next);
    }
  };

  const formattedLabels =
    allLabels?.map((label) => ({
      key: label.publicId,
      value: label.name,
      leftIcon: <LabelIcon colourCode={label.colourCode} />,
      selected: selectedLabelPublicIds.includes(label.publicId),
    })) ?? [];

  useEffect(() => {
    const newLabelId = modalStates.NEW_RESOURCE_LABEL_CREATED;
    if (!newLabelId) return;
    const current = selectedLabelPublicIds;
    if (!current.includes(newLabelId)) {
      setValue("labelPublicIds", [...current, newLabelId]);
    }
    clearModalState("NEW_RESOURCE_LABEL_CREATED");
  }, [modalStates.NEW_RESOURCE_LABEL_CREATED, selectedLabelPublicIds, setValue, clearModalState]);

  useEffect(() => {
    document.querySelector<HTMLElement>("#title")?.focus();
  }, []);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="px-5 pt-5">
        <div className="flex w-full items-center justify-between pb-4 text-neutral-900 dark:text-dark-1000">
          <h2 className="text-sm font-bold">New Resource</h2>
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
            id="title"
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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setMode("url");
                setSelectedFile(null);
                setValue("type", "link");
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${mode === "url" ? "bg-neutral-900 text-white dark:bg-dark-800 dark:text-dark-1000" : "text-light-800 ring-1 ring-inset ring-light-600 hover:bg-light-200 dark:text-dark-900 dark:ring-dark-700 dark:hover:bg-dark-300"}`}
            >
              URL
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("file");
                setValue("url", "");
                setValue("type", "other");
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${mode === "file" ? "bg-neutral-900 text-white dark:bg-dark-800 dark:text-dark-1000" : "text-light-800 ring-1 ring-inset ring-light-600 hover:bg-light-200 dark:text-dark-900 dark:ring-dark-700 dark:hover:bg-dark-300"}`}
            >
              File
            </button>
            <span className="ml-auto flex items-center rounded-full bg-light-300 px-2.5 py-0.5 text-xs font-medium text-light-900 dark:bg-dark-400 dark:text-dark-900">
              {selectedType.charAt(0).toUpperCase() + selectedType.slice(1)}
            </span>
          </div>
          {mode === "file" ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setSelectedFile(file);
                  if (file) {
                    setValue("type", detectTypeFromMime(file.type) as FormValues["type"]);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm ring-1 ring-inset ring-light-600 hover:bg-light-200 dark:ring-dark-700 dark:hover:bg-dark-300"
              >
                <TbUpload className="h-4 w-4 text-neutral-500 dark:text-dark-800" />
                <span className="truncate text-neutral-600 dark:text-dark-900">
                  {selectedFile ? selectedFile.name : "Choose file..."}
                </span>
              </button>
            </div>
          ) : (
            <Input
              id="url"
              placeholder="Paste a URL"
              {...register("url", {
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  const val = e.target.value.trim();
                  if (val) {
                    setValue("type", detectTypeFromUrl(val) as FormValues["type"]);
                  } else {
                    setValue("type", "link");
                  }
                },
              })}
            />
          )}
          <Input
            id="description"
            placeholder="Description (optional)"
            {...register("description")}
          />
          <div className="w-fit">
            <CheckboxDropdown
              items={formattedLabels}
              handleSelect={(_groupKey, item) => handleSelectLabel(item.key)}
              handleCreate={() => openModal("NEW_RESOURCE_LABEL")}
              createNewItemLabel="Create new label"
            >
              <div className="flex h-full w-full items-center rounded-[5px] border-[1px] border-light-600 bg-light-200 px-2 py-1 text-left text-xs text-light-800 hover:bg-light-300 dark:border-dark-600 dark:bg-dark-400 dark:text-dark-1000 dark:hover:bg-dark-500">
                {!selectedLabelPublicIds.length ? (
                  "Labels"
                ) : (
                  <>
                    <div
                      className={
                        selectedLabelPublicIds.length > 1
                          ? "flex -space-x-[2px] overflow-hidden"
                          : "flex items-center"
                      }
                    >
                      {selectedLabelPublicIds.map((labelPublicId) => {
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
                            {selectedLabelPublicIds.length === 1 && (
                              <span className="ml-1">{label?.name}</span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                    {selectedLabelPublicIds.length > 1 && (
                      <span className="ml-1">
                        {`${selectedLabelPublicIds.length} labels`}
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
        <Button type="submit" isLoading={createItem.isPending || isUploading}>
          {isUploading ? "Uploading..." : "Create"}
        </Button>
      </div>
    </form>
  );
}
