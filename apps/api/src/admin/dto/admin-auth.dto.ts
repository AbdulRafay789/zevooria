import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_MAX_LENGTH } from '../../common/validation/password';

export class AdminLoginDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  /** Login authenticates only — do not enforce creation policy here. */
  @IsString()
  @MinLength(1)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;
}
