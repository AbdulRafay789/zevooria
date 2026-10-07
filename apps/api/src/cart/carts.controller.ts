import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { User } from '../auth/entities/user.entity';
import { CartsService } from './carts.service';
import { MergeCartDto, UpsertCartItemDto } from './dto/cart.dto';

function readGuestKey(
  headers: Record<string, string | string[] | undefined>,
): string | null {
  const raw = headers['x-cart-guest-key'] ?? headers['X-Cart-Guest-Key'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.trim() || null;
}

@Controller('cart')
export class CartsController {
  constructor(private readonly carts: CartsService) {}

  @Get()
  @UseGuards(OptionalAuthGuard)
  getCart(
    @Req() req: AuthenticatedRequest & { user?: User },
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.carts.getCart({
      userId: req.user?.id ?? null,
      guestKey: req.user ? null : readGuestKey(headers),
    });
  }

  @Put('items')
  @UseGuards(OptionalAuthGuard)
  upsertItem(
    @Req() req: AuthenticatedRequest & { user?: User },
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: UpsertCartItemDto,
  ) {
    return this.carts.upsertItem(
      {
        userId: req.user?.id ?? null,
        guestKey: req.user ? null : readGuestKey(headers),
      },
      body.productId,
      body.quantity,
    );
  }

  @Delete('items/:productId')
  @UseGuards(OptionalAuthGuard)
  removeItem(
    @Req() req: AuthenticatedRequest & { user?: User },
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('productId') productId: string,
  ) {
    return this.carts.upsertItem(
      {
        userId: req.user?.id ?? null,
        guestKey: req.user ? null : readGuestKey(headers),
      },
      productId,
      0,
    );
  }

  @Post('clear')
  @UseGuards(OptionalAuthGuard)
  clear(
    @Req() req: AuthenticatedRequest & { user?: User },
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.carts.clear({
      userId: req.user?.id ?? null,
      guestKey: req.user ? null : readGuestKey(headers),
    });
  }

  @Post('merge')
  @UseGuards(AuthGuard)
  merge(
    @Req() req: AuthenticatedRequest & { user: User },
    @Body() body: MergeCartDto,
  ) {
    return this.carts.mergeGuestIntoUser(req.user.id, body.guestKey);
  }
}
