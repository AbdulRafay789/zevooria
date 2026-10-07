import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSupportReplyDto {
  @IsString()
  @MinLength(1, { message: 'Reply message cannot be empty.' })
  @MaxLength(100_000)
  bodyText!: string;
}
