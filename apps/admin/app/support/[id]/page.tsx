'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AdminShell } from '../../../components/admin-shell';
import { useAdminAuth } from '../../../components/admin-auth-provider';
import {
  AdminApiError,
  fetchAdminStaff,
  fetchSupportAttachmentAccess,
  fetchSupportConversation,
  formatDate,
  replySupportConversation,
  updateSupportConversation,
  type SupportAttachment,
  type SupportConversationDetail,
  type SupportConversationStatus,
  type SupportMessage,
} from '../../../lib/admin-api';
import { hasPermission } from '../../../lib/admin-permissions';
import {
  applySuccessfulSupportReply,
  buildAssigneeOptions,
  canShowSupportReplyComposer,
  formatAttachmentKind,
  formatAttachmentSize,
  supportAttachmentActionLabel,
  supportMessageBodyText,
  supportStatusLabel,
  supportSubjectDisplay,
  validateSupportReplyBody,
} from '../../../lib/support-inbox';
import styles from '../../admin.module.css';

export default function AdminSupportConversationPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAdminAuth();
  const canUpdate = hasPermission(user, 'support:update');
  const canManageStaff = hasPermission(user, 'admins:manage');
  const canViewCustomers = hasPermission(user, 'customers:read');

  const [detail, setDetail] = useState<SupportConversationDetail | null>(null);
  const [staffOptions, setStaffOptions] = useState<
    Array<{ id: string; fullName: string; email: string; isActive: boolean }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingAssignee, setSavingAssignee] = useState(false);
  const [openingAttachmentId, setOpeningAttachmentId] = useState<string | null>(
    null,
  );
  const [replyBody, setReplyBody] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  async function openAttachment(attachmentId: string) {
    if (!params.id) {
      return;
    }
    setOpeningAttachmentId(attachmentId);
    setError(null);
    try {
      const access = await fetchSupportAttachmentAccess(params.id, attachmentId);
      window.open(access.url, '_blank', 'noopener,noreferrer');
    } catch {
      setError('Unable to open attachment.');
    } finally {
      setOpeningAttachmentId(null);
    }
  }

  useEffect(() => {
    if (!params.id) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSupportConversation(params.id)
      .then((result) => {
        if (!cancelled) {
          setDetail(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Unable to load this conversation.');
          setDetail(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  useEffect(() => {
    if (!canUpdate || !canManageStaff) {
      return;
    }
    let cancelled = false;
    fetchAdminStaff()
      .then((rows) => {
        if (!cancelled) {
          setStaffOptions(rows);
        }
      })
      .catch(() => {
        // Assignment still works with self + current assignee.
      });
    return () => {
      cancelled = true;
    };
  }, [canUpdate, canManageStaff]);

  const assigneeOptions = useMemo(
    () =>
      buildAssigneeOptions({
        currentUser: user
          ? { id: user.id, fullName: user.fullName, email: user.email }
          : null,
        currentAssignee: detail?.assignee
          ? {
              id: detail.assignee.id,
              fullName: detail.assignee.fullName,
              email: detail.assignee.email,
            }
          : null,
        staff: staffOptions,
      }),
    [user, detail?.assignee, staffOptions],
  );

  const showReplyComposer = canShowSupportReplyComposer({
    canUpdate,
    requesterEmail: detail?.conversation.requesterEmail,
  });

  async function sendReply() {
    if (!detail || sendingReply) {
      return;
    }
    const validationError = validateSupportReplyBody(replyBody);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSendingReply(true);
    setError(null);
    setNotice(null);
    try {
      const result = await replySupportConversation(
        detail.conversation.id,
        replyBody,
      );
      const next = applySuccessfulSupportReply({
        messages: detail.messages,
        replyBody,
        conversation: detail.conversation,
        result,
      });
      setDetail({
        ...detail,
        conversation: next.conversation,
        messages: next.messages,
      });
      setReplyBody(next.replyBody);
      setNotice('Reply sent.');
    } catch {
      setError('Unable to send reply. Please try again.');
    } finally {
      setSendingReply(false);
    }
  }

  async function onStatusChange(next: SupportConversationStatus) {
    if (!detail || !canUpdate || next === detail.conversation.status) {
      return;
    }
    const previous = detail.conversation.status;
    setDetail({
      ...detail,
      conversation: { ...detail.conversation, status: next },
    });
    setSavingStatus(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateSupportConversation(detail.conversation.id, {
        status: next,
      });
      setDetail((current) =>
        current
          ? {
              ...current,
              conversation: { ...current.conversation, ...updated },
            }
          : current,
      );
      setNotice('Conversation status updated.');
    } catch (err: unknown) {
      setDetail((current) =>
        current
          ? {
              ...current,
              conversation: { ...current.conversation, status: previous },
            }
          : current,
      );
      setError(
        err instanceof AdminApiError
          ? 'Unable to update conversation status.'
          : 'Unable to update conversation status.',
      );
    } finally {
      setSavingStatus(false);
    }
  }

  async function onAssigneeChange(raw: string) {
    if (!detail || !canUpdate) {
      return;
    }
    const nextId = raw === '' ? null : raw;
    const previousId = detail.conversation.assigneeAdminId;
    if (nextId === previousId) {
      return;
    }
    const previousAssignee = detail.assignee;
    const staffMatch = staffOptions.find((row) => row.id === nextId);
    const selfMatch =
      user && user.id === nextId
        ? { id: user.id, fullName: user.fullName, email: user.email, isActive: true }
        : null;
    const nextAssignee =
      nextId == null
        ? null
        : staffMatch
          ? {
              id: staffMatch.id,
              fullName: staffMatch.fullName,
              email: staffMatch.email,
              isActive: staffMatch.isActive,
            }
          : selfMatch;

    setDetail({
      ...detail,
      conversation: { ...detail.conversation, assigneeAdminId: nextId },
      assignee: nextAssignee,
    });
    setSavingAssignee(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateSupportConversation(detail.conversation.id, {
        assigneeAdminId: nextId,
      });
      const refreshed = await fetchSupportConversation(detail.conversation.id);
      setDetail(refreshed);
      setNotice(
        updated.assigneeAdminId
          ? 'Conversation assigned.'
          : 'Conversation unassigned.',
      );
    } catch {
      setDetail((current) =>
        current
          ? {
              ...current,
              conversation: {
                ...current.conversation,
                assigneeAdminId: previousId,
              },
              assignee: previousAssignee,
            }
          : current,
      );
      setError('Unable to update conversation assignee.');
    } finally {
      setSavingAssignee(false);
    }
  }

  const conversation = detail?.conversation;

  return (
    <AdminShell title="Support conversation">
      <p className={styles.meta}>
        <Link href="/support">← Support</Link>
      </p>

      {error ? <p className={styles.error}>{error}</p> : null}
      {notice ? <p className={styles.success}>{notice}</p> : null}
      {loading ? <p className={styles.lede}>Loading conversation…</p> : null}

      {conversation ? (
        <>
          <div className={styles.panelStaticHeader}>
            <div>
              <p className={styles.orderNumber}>
                {supportSubjectDisplay(conversation.subject)}
              </p>
              <p className={styles.meta}>
                {conversation.requesterName
                  ? `${conversation.requesterName} · ${conversation.requesterEmail}`
                  : conversation.requesterEmail}
                {' · '}
                Last activity {formatDate(conversation.lastMessageAt)}
              </p>
            </div>
            <div className={styles.inlineForm}>
              <label className={styles.field}>
                <span>Status</span>
                {canUpdate ? (
                  <select
                    value={conversation.status}
                    disabled={savingStatus}
                    onChange={(event) => {
                      void onStatusChange(
                        event.target.value as SupportConversationStatus,
                      );
                    }}
                  >
                    <option value="open">Open</option>
                    <option value="pending">Pending</option>
                    <option value="closed">Closed</option>
                  </select>
                ) : (
                  <span className={styles.chip}>
                    {supportStatusLabel(conversation.status)}
                  </span>
                )}
              </label>
            </div>
          </div>

          <div className={styles.supportDetail}>
            <section>
              <h2 className={styles.sectionTitle}>Messages</h2>
              {(detail?.messages ?? []).length === 0 ? (
                <p className={styles.lede}>No messages in this conversation.</p>
              ) : (
                <div>
                  {(detail?.messages ?? []).map((message) => (
                    <MessageBlock
                      key={message.id}
                      message={message}
                      openingAttachmentId={openingAttachmentId}
                      onOpenAttachment={(attachmentId) => {
                        void openAttachment(attachmentId);
                      }}
                    />
                  ))}
                </div>
              )}

              {showReplyComposer ? (
                <section className={styles.supportReply}>
                  <h2 className={styles.sectionTitle}>
                    Reply to {conversation.requesterEmail}
                  </h2>
                  <label className={styles.field}>
                    <span>Message</span>
                    <textarea
                      className={styles.supportReplyTextarea}
                      value={replyBody}
                      onChange={(event) => setReplyBody(event.target.value)}
                      placeholder="Write your reply…"
                      rows={8}
                      disabled={sendingReply}
                      aria-label="Reply message"
                    />
                  </label>
                  <div className={styles.supportReplyActions}>
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      disabled={sendingReply}
                      onClick={() => {
                        void sendReply();
                      }}
                    >
                      {sendingReply ? 'Sending…' : 'Send Reply'}
                    </button>
                  </div>
                </section>
              ) : null}
            </section>

            <aside className={styles.supportSidebar}>
              <section className={styles.panelCard}>
                <h2 className={styles.sectionTitle}>Conversation</h2>
                <p className={styles.meta}>
                  Status: {supportStatusLabel(conversation.status)}
                </p>
                <p className={styles.meta}>
                  Created {formatDate(conversation.createdAt)}
                </p>
              </section>

              <section className={styles.panelCard}>
                <h2 className={styles.sectionTitle}>Customer</h2>
                {detail?.customer ? (
                  <>
                    <p className={styles.orderNumber}>
                      {canViewCustomers ? (
                        <Link href={`/customers/${detail.customer.id}`}>
                          {detail.customer.fullName}
                        </Link>
                      ) : (
                        detail.customer.fullName
                      )}
                    </p>
                    <p className={styles.meta}>
                      {canViewCustomers ? (
                        <Link href={`/customers/${detail.customer.id}`}>
                          {detail.customer.email}
                        </Link>
                      ) : (
                        detail.customer.email
                      )}
                    </p>
                    <p className={styles.meta}>
                      Phone: {detail.customer.phone ?? '—'}
                    </p>
                    <p className={styles.meta}>
                      Email verified:{' '}
                      {detail.customer.emailVerifiedAt
                        ? formatDate(detail.customer.emailVerifiedAt)
                        : 'Not verified'}
                    </p>
                    <p className={styles.meta}>
                      Active: {detail.customer.isActive ? 'Yes' : 'No'}
                    </p>
                  </>
                ) : (
                  <p className={styles.lede}>
                    No registered customer account
                  </p>
                )}
              </section>

              <section className={styles.panelCard}>
                <h2 className={styles.sectionTitle}>Assignee</h2>
                {canUpdate ? (
                  <label className={styles.field}>
                    <span>Assigned to</span>
                    <select
                      value={conversation.assigneeAdminId ?? ''}
                      disabled={savingAssignee}
                      onChange={(event) => {
                        void onAssigneeChange(event.target.value);
                      }}
                    >
                      <option value="">Unassigned</option>
                      {assigneeOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : detail?.assignee ? (
                  <p className={styles.meta}>
                    {detail.assignee.fullName} ({detail.assignee.email})
                  </p>
                ) : (
                  <p className={styles.meta}>Unassigned</p>
                )}
              </section>

              <section className={styles.panelCard}>
                <h2 className={styles.sectionTitle}>Attachments</h2>
                {allAttachments(detail?.messages ?? []).length === 0 ? (
                  <p className={styles.meta}>No attachments.</p>
                ) : (
                  <ul className={styles.supportAttachments}>
                    {allAttachments(detail?.messages ?? []).map((att) => (
                      <AttachmentRow
                        key={att.id}
                        attachment={att}
                        opening={openingAttachmentId === att.id}
                        onOpen={() => {
                          void openAttachment(att.id);
                        }}
                      />
                    ))}
                  </ul>
                )}
              </section>
            </aside>
          </div>
        </>
      ) : null}
    </AdminShell>
  );
}

function MessageBlock({
  message,
  openingAttachmentId,
  onOpenAttachment,
}: {
  message: SupportMessage;
  openingAttachmentId: string | null;
  onOpenAttachment: (attachmentId: string) => void;
}) {
  const directionLabel =
    message.direction === 'outbound' ? 'Outbound' : 'Inbound';
  return (
    <article className={styles.supportMessage}>
      <div className={styles.panelStaticHeader}>
        <div>
          <p className={styles.orderNumber}>
            {directionLabel} · {message.fromEmail}
          </p>
          <p className={styles.meta}>To {message.toEmail}</p>
        </div>
        <span className={styles.chipMuted}>{formatDate(message.createdAt)}</span>
      </div>
      <p className={styles.supportMessageBody}>
        {supportMessageBodyText({
          bodyText: message.bodyText,
          bodyHtml: message.bodyHtml,
        })}
      </p>
      {message.attachments.length > 0 ? (
        <ul className={styles.supportAttachments}>
          {message.attachments.map((att) => (
            <AttachmentRow
              key={att.id}
              attachment={att}
              opening={openingAttachmentId === att.id}
              onOpen={() => onOpenAttachment(att.id)}
            />
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function AttachmentRow({
  attachment,
  opening,
  onOpen,
}: {
  attachment: SupportAttachment;
  opening: boolean;
  onOpen: () => void;
}) {
  const action = supportAttachmentActionLabel(attachment.contentType);
  return (
    <li className={styles.supportAttachmentItem}>
      <p className={styles.supportAttachmentName}>{attachment.fileName}</p>
      <p className={styles.supportAttachmentMeta}>
        {formatAttachmentKind(attachment.contentType)} ·{' '}
        {formatAttachmentSize(attachment.sizeBytes)}
      </p>
      <button
        type="button"
        className={styles.ghostBtn}
        disabled={opening}
        onClick={onOpen}
      >
        {opening ? 'Opening…' : action}
      </button>
    </li>
  );
}

function allAttachments(messages: SupportMessage[]) {
  return messages.flatMap((message) => message.attachments);
}
