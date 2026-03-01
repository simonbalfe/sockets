import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { HiXMark } from "react-icons/hi2";
import Button from "~/components/Button";
import Input from "~/components/Input";
import Toggle from "~/components/Toggle";
import { colours } from "~/lib/shared/constants";
import { useModal } from "~/providers/modal";
import { api, apiKeys } from "~/utils/api";

const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

interface FormInput {
  name: string;
  colourCode: string;
  isCreateAnotherEnabled?: boolean;
}

export function ResourceLabelForm() {
  const queryClient = useQueryClient();
  const { closeModal, setModalState } = useModal();

  const [customHex, setCustomHex] = useState("");
  const nativePickerRef = useRef<HTMLInputElement>(null);

  const { register, reset, handleSubmit, setValue, watch } =
    useForm<FormInput>({
      defaultValues: {
        name: "",
        colourCode: colours[0]!.code,
        isCreateAnotherEnabled: false,
      },
    });

  const selectedCode = watch("colourCode");
  const isCreateAnotherEnabled = watch("isCreateAnotherEnabled");
  const isPreset = colours.some((c) => c.code === selectedCode);

  const createLabel = useMutation({
    mutationFn: api.resourceLabel.create,
    onSuccess: async (newLabel) => {
      const currentColourIndex = colours.findIndex(
        (c) => c.code === selectedCode,
      );
      await queryClient.refetchQueries({
        queryKey: apiKeys.resourceLabel.all(),
      });
      setModalState("NEW_RESOURCE_LABEL_CREATED", newLabel.publicId);
      if (!isCreateAnotherEnabled) {
        closeModal();
      } else {
        const nextCode = colours[(currentColourIndex + 1) % colours.length]!.code;
        reset({
          name: "",
          colourCode: nextCode,
          isCreateAnotherEnabled,
        });
        setCustomHex("");
      }
    },
  });

  const onSubmit = (values: FormInput) => {
    if (!values.colourCode || !HEX_REGEX.test(values.colourCode)) return;
    createLabel.mutate({
      name: values.name,
      colourCode: values.colourCode,
    });
  };

  useEffect(() => {
    document.querySelector<HTMLElement>("#resource-label-name")?.focus();
  }, []);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="px-5 pt-5">
        <div className="flex w-full items-center justify-between pb-4 text-neutral-900 dark:text-dark-1000">
          <h2 className="text-sm font-medium">New label</h2>
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

        <Input
          id="resource-label-name"
          placeholder="Name"
          {...register("name")}
          onKeyDown={async (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              await handleSubmit(onSubmit)();
            }
          }}
        />
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-neutral-600 dark:text-dark-800">
            Colour
          </p>
          <div className="flex flex-wrap gap-2">
            {colours.map((colour) => (
              <button
                key={colour.code}
                type="button"
                onClick={() => {
                  setValue("colourCode", colour.code);
                  setCustomHex("");
                }}
                className={`h-6 w-6 rounded-full ring-offset-2 ring-offset-white transition-shadow dark:ring-offset-dark-100 ${
                  selectedCode === colour.code
                    ? "ring-2 ring-neutral-400 dark:ring-dark-700"
                    : "hover:ring-2 hover:ring-neutral-300 dark:hover:ring-dark-600"
                }`}
                style={{ backgroundColor: colour.code }}
                title={colour.name}
              />
            ))}
            <button
              type="button"
              onClick={() => nativePickerRef.current?.click()}
              className={`relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-red-400 via-green-400 to-blue-500 ring-offset-2 ring-offset-white transition-shadow dark:ring-offset-dark-100 ${
                !isPreset && selectedCode
                  ? "ring-2 ring-neutral-400 dark:ring-dark-700"
                  : "hover:ring-2 hover:ring-neutral-300 dark:hover:ring-dark-600"
              }`}
              title="Pick custom colour"
            >
              <input
                ref={nativePickerRef}
                type="color"
                value={selectedCode}
                onChange={(e) => {
                  const hex = e.target.value;
                  setValue("colourCode", hex);
                  setCustomHex(hex);
                }}
                className="absolute inset-0 cursor-pointer opacity-0"
                tabIndex={-1}
              />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div
              className="h-5 w-5 shrink-0 rounded-full border border-light-400 dark:border-dark-600"
              style={{ backgroundColor: selectedCode }}
            />
            <input
              type="text"
              value={!isPreset ? customHex || selectedCode : customHex}
              onChange={(e) => {
                let val = e.target.value;
                if (val && !val.startsWith("#")) val = `#${val}`;
                setCustomHex(val);
                if (HEX_REGEX.test(val)) {
                  setValue("colourCode", val);
                }
              }}
              placeholder="#000000"
              maxLength={7}
              className="block w-full rounded-md border-0 bg-white/5 px-3 py-1 text-xs shadow-sm ring-1 ring-inset ring-light-600 focus:ring-2 focus:ring-inset focus:ring-light-700 dark:bg-dark-300 dark:text-dark-1000 dark:ring-dark-700 dark:focus:ring-dark-700"
            />
          </div>
        </div>
      </div>

      <div className="mt-12 flex items-center justify-end border-t border-light-600 px-5 pb-5 pt-5 dark:border-dark-600">
        <Toggle
          label="Create another"
          isChecked={!!isCreateAnotherEnabled}
          onChange={() =>
            setValue("isCreateAnotherEnabled", !isCreateAnotherEnabled)
          }
        />
        <Button
          type="submit"
          isLoading={createLabel.isPending}
          disabled={!watch("name")}
        >
          Create label
        </Button>
      </div>
    </form>
  );
}
