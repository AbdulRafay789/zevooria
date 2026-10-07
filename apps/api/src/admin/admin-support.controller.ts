import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  SupportAdminService,
  supportAuditFromRequest,
} from '../support/support-admin.service';
import { CreateSupportReplyDto } from './dto/support/create-support-reply.dto';
import { ListSupportConversationsQueryDto } from './dto/support/list-support-conversations.dto';
import { UpdateSupportConversationDto } from './dto/support/update-support-conversation.dto';
import { AdminGuard, type AdminAuthenticatedRequest } from './admin.guard';
import { RequirePermissions } from './permissions.decorator';
import { PermissionsGuard } from './permissions.guard';

@Controller('admin/support')
@UseGuards(AdminGuard, PermissionsGuard)
export class AdminSupportController {
  constructor(private readonly supportAdmin: SupportAdminService) {}

  @Get('conversations')
  @RequirePermissions('support:read')
  list(@Query() query: ListSupportConversationsQueryDto) {
    return this.supportAdmin.list({
      page: query.page,
      limit: query.limit,
      status: query.status,
      search: query.search,
    });
  }

  @Get('conversations/:conversationId/attachments/:attachmentId')
  @RequirePermissions('support:read')
  getAttachment(
    @Param('conversationId', new ParseUUIDPipe({ version: '4' }))
    conversationId: string,
    @Param('attachmentId', new ParseUUIDPipe({ version: '4' }))
    attachmentId: string,
  ) {
    return this.supportAdmin.getAttachmentAccess(conversationId, attachmentId);
  }

  @Get('conversations/:id')
  @RequirePermissions('support:read')
  getOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.supportAdmin.getDetail(id);
  }

  @Patch('conversations/:id')
  @RequirePermissions('support:update')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateSupportConversationDto,
    @Req() req: Request & AdminAuthenticatedRequest,
  ) {
    return this.supportAdmin.update(id, body, supportAuditFromRequest(req));
  }

  @Post('conversations/:id/reply')
  @RequirePermissions('support:update')
  reply(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: CreateSupportReplyDto,
    @Req() req: Request & AdminAuthenticatedRequest,
  ) {
    return this.supportAdmin.reply(
      id,
      body.bodyText,
      supportAuditFromRequest(req),
    );
  }
}
