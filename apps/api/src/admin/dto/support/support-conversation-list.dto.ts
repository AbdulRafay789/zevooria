export type SupportConversationListItemDto = {
  id: string;
  subject: string;
  status: string;
  requesterEmail: string;
  requesterName: string | null;
  customerId: string | null;
  assigneeAdminId: string | null;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
};

export type SupportConversationListResponseDto = {
  items: SupportConversationListItemDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
