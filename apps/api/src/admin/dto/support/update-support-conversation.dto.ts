import { IsEnum, IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { SupportConversationStatus } from '../../../support/support.enums';

export class UpdateSupportConversationDto {
  @IsOptional()
  @IsEnum(SupportConversationStatus)
  status?: SupportConversationStatus;

  /**
   * Omit to leave unchanged. Explicit `null` clears the assignee.
   * Non-null values must be an existing admin user UUID.
   */
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsUUID('4')
  assigneeAdminId?: string | null;
}
