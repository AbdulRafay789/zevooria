import type {
  SupportConversationStatus,
  SupportConversationsQuery,
} from './admin-api';

export const SUPPORT_PAGE_SIZE = 20;

export function supportStatusLabel(status: string): string {
  switch (status) {
    case 'open':
      return 'Open';
    case 'pending':
      return 'Pending';
    case 'closed':
      return 'Closed';
    default:
      return status;
  }
}

export function supportSubjectDisplay(subject: string | null | undefined): string {
  const trimmed = subject?.trim();
  return trimmed ? trimmed : 'No subject';
}

export function formatAttachmentSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '—';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatAttachmentKind(contentType: string): string {
  const lower = contentType.toLowerCase();
  if (lower.includes('pdf')) {
    return 'PDF';
  }
  if (lower.startsWith('image/')) {
    return 'Image';
  }
  if (lower.startsWith('text/')) {
    return 'Text';
  }
  return contentType || 'File';
}

/** Prefer in-browser viewing for PDFs, images, and text. */
export function supportAttachmentActionLabel(contentType: string): 'View' | 'Download' {
  const lower = contentType.toLowerCase();
  if (
    lower === 'application/pdf' ||
    lower.startsWith('image/') ||
    lower.startsWith('text/')
  ) {
    return 'View';
  }
  return 'Download';
}

/** Reply composer is for update permission + a usable requester email. */
export function canShowSupportReplyComposer(input: {
  canUpdate: boolean;
  requesterEmail: string | null | undefined;
}): boolean {
  if (!input.canUpdate) {
    return false;
  }
  const email = input.requesterEmail?.trim() ?? '';
  return email.includes('@') && !email.includes(' ');
}

export function validateSupportReplyBody(bodyText: string): string | null {
  if (!bodyText.trim()) {
    return 'Reply message cannot be empty.';
  }
  return null;
}

/** Prevent double-submit while a reply request is in flight. */
export function canSubmitSupportReply(input: {
  sending: boolean;
  bodyText: string;
}): boolean {
  if (input.sending) {
    return false;
  }
  return validateSupportReplyBody(input.bodyText) === null;
}

/**
 * Apply a successful reply response to local detail state
 * (append timeline message, clear composer, sync conversation).
 */
export function applySuccessfulSupportReply<
  TMessage,
  TConversation extends { status: SupportConversationStatus },
>(input: {
  messages: TMessage[];
  replyBody: string;
  conversation: TConversation;
  result: { message: TMessage; conversation: Partial<TConversation> };
}): {
  messages: TMessage[];
  replyBody: string;
  conversation: TConversation;
} {
  return {
    messages: [...input.messages, input.result.message],
    replyBody: '',
    conversation: {
      ...input.conversation,
      ...input.result.conversation,
    },
  };
}

/** On reply failure, keep the draft text so the admin can retry. */
export function preserveSupportReplyBodyOnFailure(replyBody: string): string {
  return replyBody;
}

/** Safe message body for display — text only, never HTML injection. */
export function supportMessageBodyText(input: {
  bodyText: string;
  bodyHtml: string | null;
}): string {
  const text = input.bodyText?.trim();
  if (text) {
    return input.bodyText;
  }
  return '(no text body)';
}

export function parseSupportListSearchParams(
  params: URLSearchParams,
): Required<Pick<SupportConversationsQuery, 'page' | 'limit'>> & {
  status?: SupportConversationStatus;
  search?: string;
} {
  const pageRaw = Number(params.get('page') ?? '1');
  const page =
    Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.trunc(pageRaw) : 1;
  const statusRaw = params.get('status');
  const status =
    statusRaw === 'open' || statusRaw === 'pending' || statusRaw === 'closed'
      ? statusRaw
      : undefined;
  const search = params.get('search')?.trim() || undefined;
  return {
    page,
    limit: SUPPORT_PAGE_SIZE,
    status,
    search,
  };
}

export function buildSupportListHref(input: {
  page?: number;
  status?: SupportConversationStatus | '';
  search?: string;
}): string {
  const q = new URLSearchParams();
  const page = input.page && input.page > 1 ? input.page : undefined;
  if (page) {
    q.set('page', String(page));
  }
  if (input.status) {
    q.set('status', input.status);
  }
  const search = input.search?.trim();
  if (search) {
    q.set('search', search);
  }
  const suffix = q.toString();
  return suffix ? `/support?${suffix}` : '/support';
}

export function supportListEmptyMessage(filtersActive: boolean): string {
  return filtersActive
    ? 'No conversations match your filters.'
    : 'No support conversations yet.';
}

export type SupportAssigneeOption = {
  id: string;
  label: string;
};

/** Build assignee select options without inventing staff records. */
export function buildAssigneeOptions(input: {
  currentUser: { id: string; fullName: string; email: string } | null;
  currentAssignee: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  staff: Array<{ id: string; fullName: string; email: string; isActive: boolean }>;
}): SupportAssigneeOption[] {
  const byId = new Map<string, SupportAssigneeOption>();
  for (const row of input.staff) {
    if (!row.isActive) {
      continue;
    }
    byId.set(row.id, {
      id: row.id,
      label: `${row.fullName} (${row.email})`,
    });
  }
  if (input.currentUser) {
    byId.set(input.currentUser.id, {
      id: input.currentUser.id,
      label: `${input.currentUser.fullName} (${input.currentUser.email})`,
    });
  }
  if (input.currentAssignee) {
    byId.set(input.currentAssignee.id, {
      id: input.currentAssignee.id,
      label: `${input.currentAssignee.fullName} (${input.currentAssignee.email})`,
    });
  }
  return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label));
}
