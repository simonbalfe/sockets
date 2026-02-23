import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { HiOutlineClipboard, HiOutlineTrash } from "react-icons/hi2";
import Button from "~/components/Button";
import { PageHead } from "~/components/PageHead";
import { usePopup } from "~/providers/popup";
import { api, apiKeys } from "~/utils/api";
import Avatar from "./components/Avatar";
import UpdateDisplayNameForm from "./components/UpdateDisplayNameForm";

function ApiKeysSection() {
  const queryClient = useQueryClient();
  const { showPopup } = usePopup();
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: apiKeys.userApiKey.list(),
    queryFn: api.userApiKey.list,
  });

  const generate = useMutation({
    mutationFn: api.userApiKey.generate,
    onSuccess: async (data) => {
      setNewKey(data.key);
      await queryClient.invalidateQueries({ queryKey: apiKeys.userApiKey.list() });
    },
    onError: () => {
      showPopup({
        header: "Error generating API key",
        message: "Please try again later.",
        icon: "error",
      });
    },
  });

  const revoke = useMutation({
    mutationFn: api.userApiKey.revoke,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: apiKeys.userApiKey.list() });
      showPopup({
        header: "API key revoked",
        message: "The API key has been revoked.",
        icon: "success",
      });
    },
    onError: () => {
      showPopup({
        header: "Error revoking API key",
        message: "Please try again later.",
        icon: "error",
      });
    },
  });

  const handleCopy = async () => {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mb-4">
      <h2 className="mb-2 mt-8 text-[14px] font-bold text-neutral-900 dark:text-dark-1000">
        {"API Keys"}
      </h2>
      <p className="mb-4 text-sm text-light-700 dark:text-dark-700">
        {"Use API keys to authenticate requests to the Kan API."}
      </p>

      {newKey && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/20">
          <p className="mb-2 text-xs font-medium text-amber-800 dark:text-amber-400">
            {"Copy this key now — it won't be shown again."}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-white px-3 py-2 font-mono text-xs text-neutral-900 ring-1 ring-light-300 dark:bg-dark-300 dark:text-dark-1000 dark:ring-dark-600">
              {newKey}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopy}
              iconLeft={<HiOutlineClipboard className="h-4 w-4" />}
            >
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-light-700 dark:text-dark-700">{"Loading..."}</p>
      ) : keys.length > 0 ? (
        <ul className="mb-4 divide-y divide-light-300 rounded-md border border-light-300 dark:divide-dark-300 dark:border-dark-300">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <code className="font-mono text-xs text-neutral-900 dark:text-dark-1000">
                  {k.key}
                </code>
                <p className="mt-0.5 text-xs text-light-700 dark:text-dark-700">
                  {"Created "}
                  {new Date(k.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="xs"
                iconOnly
                iconLeft={<HiOutlineTrash className="h-4 w-4 text-red-500" />}
                onClick={() => revoke.mutate({ id: k.id })}
                disabled={revoke.isPending}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-light-700 dark:text-dark-700">
          {"No API keys yet."}
        </p>
      )}

      <Button
        variant="secondary"
        size="sm"
        onClick={() => generate.mutate()}
        isLoading={generate.isPending}
        disabled={generate.isPending}
      >
        {"Generate API key"}
      </Button>
    </div>
  );
}

export default function AccountSettings() {
  const { data } = useQuery({
    queryKey: apiKeys.user.getUser(),
    queryFn: api.user.getUser,
  });

  return (
    <>
      <PageHead title={"Settings | Account"} />

      <div className="mb-8 border-t border-light-300 dark:border-dark-300">
        <h2 className="mb-4 mt-8 text-[14px] font-bold text-neutral-900 dark:text-dark-1000">
          {"Profile picture"}
        </h2>
        <Avatar userId={data?.id} userImage={data?.image} />

        <div className="mb-4">
          <h2 className="mb-4 mt-8 text-[14px] font-bold text-neutral-900 dark:text-dark-1000">
            {"Display name"}
          </h2>
          <UpdateDisplayNameForm displayName={data?.name ?? ""} />
        </div>

        <div className="mb-4">
          <h2 className="mb-4 mt-8 text-[14px] font-bold text-neutral-900 dark:text-dark-1000">
            {"Email"}
          </h2>
          <p className="text-sm text-neutral-700 dark:text-dark-900">
            {data?.email}
          </p>
        </div>

        <ApiKeysSection />
      </div>
    </>
  );
}
