import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isValidPakistanPhone, normalizePakistanPhone } from './phone';

@ValidatorConstraint({ name: 'isPakistanPhone', async: false })
export class IsPakistanPhoneConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidPakistanPhone(value);
  }

  defaultMessage(): string {
    return 'Enter an 11-digit Pakistan mobile number starting with 03 (e.g. 03001234567).';
  }
}

export function IsPakistanPhone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsPakistanPhoneConstraint,
    });
  };
}

/** Normalize after validation (call from services or Transform). */
export function toStoredPakistanPhone(value: string): string {
  const normalized = normalizePakistanPhone(value);
  if (!normalized) {
    throw new Error('Invalid Pakistan phone.');
  }
  return normalized;
}
