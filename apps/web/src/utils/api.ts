import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const API = "/api";

interface ApiLabel {
  publicId: string;
  name: string;
  colourCode: string | null;
}

interface ApiChecklistItem {
  publicId: string;
  title: string;
  completed: boolean;
  index: number;
}

interface ApiChecklist {
  publicId: string;
  name: string;
  index: number;
  items: ApiChecklistItem[];
}

interface ApiBoardCard {
  publicId: string;
  title: string;
  description: string | null;
  listId: number;
  index: number;
  dueDate: string | null;
  labels: ApiLabel[];
  checklists: ApiChecklist[];
}

interface ApiBoardList {
  publicId: string;
  name: string;
  boardId: number;
  index: number;
  cards: ApiBoardCard[];
}

interface ApiBoard {
  publicId: string;
  name: string;
  slug: string;
  visibility: string;
  labels: ApiLabel[];
  lists: ApiBoardList[];
  allLists: { publicId: string; name: string }[];
}

interface ApiBoardSummary {
  publicId: string;
  name: string;
  lists: { publicId: string; name: string; index: number }[];
  labels: ApiLabel[];
}

interface ApiCardDetail {
  id: number;
  publicId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  createdBy: string;
  labels: ApiLabel[];
  checklists: ApiChecklist[];
  list: {
    publicId: string;
    name: string;
    board: {
      publicId: string;
      name: string;
      labels: ApiLabel[];
      lists: { publicId: string; name: string }[];
    };
  };
}

interface ApiKnowledgeLabel {
  publicId: string;
  name: string;
  colourCode: string | null;
}

interface ApiKnowledgeItem {
  publicId: string;
  title: string;
  description: string | null;
  type: "link" | "creator" | "tweet" | "instagram" | "tiktok" | "youtube" | "linkedin" | "image" | "pdf" | "audio" | "other";
  url: string | null;
  createdAt: string;
  labels: { knowledgeLabel: ApiKnowledgeLabel }[];
}

interface ApiUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface ApiUserApiKey {
  id: string;
  key: string;
  createdAt: string;
}

interface BoardByIdInput {
  boardPublicId: string;
  members?: string[];
  labels?: string[];
  lists?: string[];
  dueDateFilters?: string[];
  type?: string;
}

interface BoardBySlugInput {
  boardSlug: string;
  members?: string[];
  labels?: string[];
  lists?: string[];
  dueDateFilters?: string[];
}

export const apiKeys = {
  board: {
    all: (input?: { type?: string }) => ["board", "all", input ?? {}] as const,
    byId: (input: BoardByIdInput) => ["board", "byId", input] as const,
    bySlug: (input: BoardBySlugInput) => ["board", "bySlug", input] as const,
    checkSlugAvailability: (input: {
      boardSlug: string;
      boardPublicId: string;
    }) => ["board", "checkSlugAvailability", input] as const,
  },
  card: {
    byId: (input: { cardPublicId: string }) => ["card", "byId", input] as const,
  },
  label: {
    byPublicId: (input: { labelPublicId: string }) =>
      ["label", "byPublicId", input] as const,
  },
  knowledgeItem: {
    all: () => ["knowledgeItem", "all"] as const,
    search: (input: { types?: string[]; labels?: string[] }) =>
      ["knowledgeItem", "search", input] as const,
    byId: (input: { publicId: string }) =>
      ["knowledgeItem", "byId", input] as const,
  },
  knowledgeLabel: {
    all: () => ["knowledgeLabel", "all"] as const,
  },
  user: {
    getUser: () => ["user", "getUser"] as const,
  },
  userApiKey: {
    list: () => ["userApiKey", "list"] as const,
  },
  health: {
    health: () => ["health"] as const,
    stats: () => ["stats"] as const,
  },
};

function qs(params: Record<string, unknown>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      for (const i of v) s.append(k, String(i));
      continue;
    }
    s.set(k, String(v));
  }
  const str = s.toString();
  return str ? `?${str}` : "";
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

export const api = {
  board: {
    all: (input?: { type?: string }) =>
      get<ApiBoardSummary[]>(`/boards${qs({ type: input?.type })}`),

    byId: (input: BoardByIdInput) =>
      get<ApiBoard>(
        `/boards/${input.boardPublicId}${qs({
          members: input.members,
          labels: input.labels,
          lists: input.lists,
          dueDateFilters: input.dueDateFilters,
          type: input.type,
        })}`,
      ),

    bySlug: (input: BoardBySlugInput) =>
      get<ApiBoard>(
        `/boards/by-slug/${input.boardSlug}${qs({
          members: input.members,
          labels: input.labels,
          lists: input.lists,
          dueDateFilters: input.dueDateFilters,
        })}`,
      ),

    create: (input: {
      name: string;
      lists: string[];
      labels: string[];
      type?: string;
      sourceBoardPublicId?: string;
    }) =>
      post<{ id: number; publicId: string; name: string }>("/boards", input),

    update: (input: {
      boardPublicId: string;
      name?: string;
      slug?: string;
      visibility?: string;
    }) =>
      put<{ publicId: string; name: string }>(
        `/boards/${input.boardPublicId}`,
        {
          name: input.name,
          slug: input.slug,
          visibility: input.visibility,
        },
      ),

    delete: (input: { boardPublicId: string }) =>
      del<{ success: boolean }>(`/boards/${input.boardPublicId}`),

    checkSlugAvailability: (input: {
      boardSlug: string;
      boardPublicId: string;
    }) =>
      get<{ isReserved: boolean }>(
        `/boards/${input.boardPublicId}/check-slug${qs({ boardSlug: input.boardSlug })}`,
      ),
  },

  card: {
    byId: (input: { cardPublicId: string }) =>
      get<ApiCardDetail>(`/cards/${input.cardPublicId}`),

    create: (input: {
      title: string;
      description: string;
      listPublicId: string;
      labelPublicIds: string[];
      position: string;
      dueDate?: string | null;
    }) =>
      post<{ id: number; listId: number; publicId: string }>("/cards", input),

    update: (input: {
      cardPublicId: string;
      title?: string;
      description?: string;
      index?: number;
      listPublicId?: string;
      dueDate?: string | null;
    }) =>
      put<{
        id: number;
        publicId: string;
        title: string;
        description: string | null;
        dueDate: string | null;
      }>(`/cards/${input.cardPublicId}`, {
        title: input.title,
        description: input.description,
        index: input.index,
        listPublicId: input.listPublicId,
        dueDate: input.dueDate,
      }),

    delete: (input: { cardPublicId: string }) =>
      del<{ success: boolean }>(`/cards/${input.cardPublicId}`),

    addOrRemoveLabel: (input: {
      cardPublicId: string;
      labelPublicId: string;
    }) =>
      put<{ newLabel: boolean }>(
        `/cards/${input.cardPublicId}/labels/${input.labelPublicId}`,
        {},
      ),
  },

  list: {
    create: (input: { name: string; boardPublicId: string }) =>
      post<{ id: number; publicId: string; name: string }>("/lists", input),

    update: (input: { listPublicId: string; name?: string; index?: number }) =>
      put<{ publicId: string; name: string }>(`/lists/${input.listPublicId}`, {
        name: input.name,
        index: input.index,
      }),

    delete: (input: { listPublicId: string }) =>
      del<{ success: boolean }>(`/lists/${input.listPublicId}`),
  },

  checklist: {
    create: (input: { cardPublicId: string; name: string }) =>
      post<{ publicId: string; name: string }>("/checklists", input),

    update: (input: { checklistPublicId: string; name: string }) =>
      put<{ publicId: string; name: string }>(
        `/checklists/${input.checklistPublicId}`,
        { name: input.name },
      ),

    delete: (input: { checklistPublicId: string }) =>
      del<{ success: boolean }>(`/checklists/${input.checklistPublicId}`),

    createItem: (input: { checklistPublicId: string; title: string }) =>
      post<{ publicId: string; title: string }>(
        `/checklists/${input.checklistPublicId}/items`,
        { title: input.title },
      ),

    updateItem: (input: {
      checklistItemPublicId: string;
      title?: string;
      completed?: boolean;
      index?: number;
    }) =>
      patch<{ publicId: string; title: string; completed: boolean }>(
        `/checklists/items/${input.checklistItemPublicId}`,
        {
          title: input.title,
          completed: input.completed,
          index: input.index,
        },
      ),

    deleteItem: (input: { checklistItemPublicId: string }) =>
      del<{ success: boolean }>(
        `/checklists/items/${input.checklistItemPublicId}`,
      ),
  },

  label: {
    byPublicId: (input: { labelPublicId: string }) =>
      get<ApiLabel>(`/labels/${input.labelPublicId}`),

    create: (input: {
      name: string;
      boardPublicId: string;
      colourCode: string;
    }) => post<ApiLabel>("/labels", input),

    update: (input: {
      labelPublicId: string;
      name: string;
      colourCode: string;
    }) =>
      put<ApiLabel>(`/labels/${input.labelPublicId}`, {
        name: input.name,
        colourCode: input.colourCode,
      }),

    delete: (input: { labelPublicId: string }) =>
      del<{ success: boolean }>(`/labels/${input.labelPublicId}`),
  },

  knowledgeItem: {
    all: () => get<ApiKnowledgeItem[]>("/knowledge-items"),

    search: (input: { types?: string[]; labels?: string[] }) => {
      const params = new URLSearchParams();
      if (input.types?.length) params.set("type", input.types.join(","));
      if (input.labels?.length) params.set("label", input.labels.join(","));
      return get<ApiKnowledgeItem[]>(
        `/knowledge-items/search?${params.toString()}`,
      );
    },

    byId: (input: { publicId: string }) =>
      get<ApiKnowledgeItem>(`/knowledge-items/${input.publicId}`),

    create: (input: {
      title: string;
      type: ApiKnowledgeItem["type"];
      url?: string | null;
      description?: string | null;
    }) => post<ApiKnowledgeItem>("/knowledge-items", input),

    update: (input: {
      publicId: string;
      title?: string;
      type?: ApiKnowledgeItem["type"];
      url?: string | null;
      description?: string | null;
    }) =>
      put<ApiKnowledgeItem>(`/knowledge-items/${input.publicId}`, {
        title: input.title,
        type: input.type,
        url: input.url,
        description: input.description,
      }),

    delete: (input: { publicId: string }) =>
      del<{ success: boolean }>(`/knowledge-items/${input.publicId}`),

    toggleLabel: (input: { publicId: string; labelPublicId: string }) =>
      put<{ added: boolean }>(
        `/knowledge-items/${input.publicId}/labels/${input.labelPublicId}`,
        {},
      ),
  },

  knowledgeLabel: {
    all: () => get<ApiKnowledgeLabel[]>("/knowledge-items/labels/all"),

    create: (input: { name: string; colourCode: string }) =>
      post<ApiKnowledgeLabel>("/knowledge-items/labels", input),

    update: (input: {
      labelPublicId: string;
      name: string;
      colourCode: string;
    }) =>
      put<ApiKnowledgeLabel>(
        `/knowledge-items/labels/${input.labelPublicId}`,
        { name: input.name, colourCode: input.colourCode },
      ),

    delete: (input: { labelPublicId: string }) =>
      del<{ success: boolean }>(
        `/knowledge-items/labels/${input.labelPublicId}`,
      ),
  },

  user: {
    getUser: () => get<ApiUser>("/users/me"),

    update: (input: { name?: string; image?: string }) =>
      put<{ name: string | null; image: string | null }>("/users", input),
  },

  userApiKey: {
    list: () => get<ApiUserApiKey[]>("/user-api-keys"),

    generate: () => post<{ key: string }>("/user-api-keys", {}),

    revoke: (input: { id: string }) =>
      del<{ success: boolean }>(`/user-api-keys/${input.id}`),
  },

  health: {
    health: () => get<{ status: string; database: string }>("/health"),
    stats: () =>
      get<{ boards: number; cards: number; users: number }>("/stats"),
  },
};

export const queryClient = new QueryClient();
export const QueryProvider = QueryClientProvider;
