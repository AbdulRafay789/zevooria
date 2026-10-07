import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAssigneeOptions,
  buildSupportListHref,
  formatAttachmentKind,
  formatAttachmentSize,
  parseSupportListSearchParams,
  applySuccessfulSupportReply,
  canShowSupportReplyComposer,
  canSubmitSupportReply,
  preserveSupportReplyBodyOnFailure,
  supportAttachmentActionLabel,
  supportListEmptyMessage,
  supportMessageBodyText,
  supportStatusLabel,
  supportSubjectDisplay,
  validateSupportReplyBody,
} from './support-inbox';

test('support status labels', () => {
  assert.equal(supportStatusLabel('open'), 'Open');
  assert.equal(supportStatusLabel('pending'), 'Pending');
  assert.equal(supportStatusLabel('closed'), 'Closed');
});

test('subject falls back to No subject', () => {
  assert.equal(supportSubjectDisplay(''), 'No subject');
  assert.equal(supportSubjectDisplay('  '), 'No subject');
  assert.equal(supportSubjectDisplay('Order issue'), 'Order issue');
});

test('list search params parse page/status/search', () => {
  const parsed = parseSupportListSearchParams(
    new URLSearchParams('page=2&status=pending&search=refund'),
  );
  assert.deepEqual(parsed, {
    page: 2,
    limit: 20,
    status: 'pending',
    search: 'refund',
  });
});

test('buildSupportListHref encodes filters and omits defaults', () => {
  assert.equal(buildSupportListHref({}), '/support');
  assert.equal(
    buildSupportListHref({ page: 2, status: 'open', search: 'hello' }),
    '/support?page=2&status=open&search=hello',
  );
});

test('empty state messages', () => {
  assert.equal(
    supportListEmptyMessage(false),
    'No support conversations yet.',
  );
  assert.equal(
    supportListEmptyMessage(true),
    'No conversations match your filters.',
  );
});

test('message body prefers text and never returns HTML markup as trusted HTML', () => {
  const body = supportMessageBodyText({
    bodyText: 'Hello\nworld',
    bodyHtml: '<script>alert(1)</script><p>Hello</p>',
  });
  assert.equal(body, 'Hello\nworld');
  assert.equal(body.includes('<script>'), false);

  const fallback = supportMessageBodyText({
    bodyText: '   ',
    bodyHtml: '<b>x</b>',
  });
  assert.equal(fallback, '(no text body)');
  assert.equal(fallback.includes('<b>'), false);
});

test('attachment metadata formatting', () => {
  assert.equal(formatAttachmentSize(245 * 1024), '245 KB');
  assert.equal(formatAttachmentKind('application/pdf'), 'PDF');
});

test('attachment action label prefers View for browser-friendly types', () => {
  assert.equal(supportAttachmentActionLabel('application/pdf'), 'View');
  assert.equal(supportAttachmentActionLabel('image/png'), 'View');
  assert.equal(supportAttachmentActionLabel('text/plain'), 'View');
  assert.equal(
    supportAttachmentActionLabel('application/zip'),
    'Download',
  );
});

test('reply composer visible only with support:update and requester email', () => {
  assert.equal(
    canShowSupportReplyComposer({
      canUpdate: true,
      requesterEmail: 'someone@gmail.com',
    }),
    true,
  );
  assert.equal(
    canShowSupportReplyComposer({
      canUpdate: false,
      requesterEmail: 'someone@gmail.com',
    }),
    false,
  );
  assert.equal(
    canShowSupportReplyComposer({
      canUpdate: true,
      requesterEmail: '',
    }),
    false,
  );
});

test('reply body validation rejects empty text', () => {
  assert.equal(
    validateSupportReplyBody('   '),
    'Reply message cannot be empty.',
  );
  assert.equal(validateSupportReplyBody('Thanks'), null);
});

test('reply submit blocked while sending or empty', () => {
  assert.equal(
    canSubmitSupportReply({ sending: true, bodyText: 'Thanks' }),
    false,
  );
  assert.equal(
    canSubmitSupportReply({ sending: false, bodyText: '   ' }),
    false,
  );
  assert.equal(
    canSubmitSupportReply({ sending: false, bodyText: 'Thanks' }),
    true,
  );
});

test('successful reply appends timeline message and clears composer', () => {
  const next = applySuccessfulSupportReply({
    messages: [{ id: 'm1', bodyText: 'Hello' }],
    replyBody: 'We are looking into this.',
    conversation: {
      status: 'open' as 'open' | 'pending' | 'closed',
      id: 'c1',
    },
    result: {
      message: { id: 'm2', bodyText: 'We are looking into this.' },
      conversation: { status: 'pending' as 'open' | 'pending' | 'closed' },
    },
  });
  assert.equal(next.messages.length, 2);
  assert.equal(next.messages[1]?.id, 'm2');
  assert.equal(next.replyBody, '');
  assert.equal(next.conversation.status, 'pending');
});

test('failed reply preserves textarea content', () => {
  assert.equal(
    preserveSupportReplyBodyOnFailure('Draft stays here'),
    'Draft stays here',
  );
});

test('unknown customer email still allows reply composer', () => {
  assert.equal(
    canShowSupportReplyComposer({
      canUpdate: true,
      requesterEmail: 'someone@gmail.com',
    }),
    true,
  );
});

test('assignee options include self, current assignee, and active staff', () => {
  const options = buildAssigneeOptions({
    currentUser: {
      id: 'me',
      fullName: 'Me',
      email: 'me@zevooria.com',
    },
    currentAssignee: {
      id: 'them',
      fullName: 'Them',
      email: 'them@zevooria.com',
    },
    staff: [
      {
        id: 'inactive',
        fullName: 'Inactive',
        email: 'x@zevooria.com',
        isActive: false,
      },
      {
        id: 'staff',
        fullName: 'Staff',
        email: 'staff@zevooria.com',
        isActive: true,
      },
    ],
  });
  const ids = options.map((row) => row.id).sort();
  assert.deepEqual(ids, ['me', 'staff', 'them']);
});
