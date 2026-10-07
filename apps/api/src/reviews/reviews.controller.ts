import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  auditRequestFromHeaders,
  AuditService,
  clientIpFromRequest,
} from '../audit/audit.service';
import { AuthGuard, AuthenticatedRequest } from '../auth/auth.guard';
import { User } from '../auth/entities/user.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

@Controller()
export class ReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly auditService: AuditService,
  ) {}

  /** Public homepage customer notes — no auth; safe fields only; batched. */
  @Get('reviews/public')
  async listPublic(
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    const parsedLimit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
    const parsedOffset = offsetRaw ? Number.parseInt(offsetRaw, 10) : undefined;
    return this.reviewsService.listPublic({
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      offset: Number.isFinite(parsedOffset) ? parsedOffset : undefined,
    });
  }

  @Get('orders/:orderId/review-products')
  @UseGuards(AuthGuard)
  async reviewProducts(
    @Req() req: AuthenticatedRequest & { user: User },
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
  ) {
    const products = await this.reviewsService.listForOrder(
      req.user.id,
      orderId,
    );
    return { orderId, products };
  }

  @Post('reviews')
  @UseGuards(AuthGuard)
  async create(
    @Req() req: Request & AuthenticatedRequest & { user: User },
    @Body() body: CreateReviewDto,
  ) {
    const review = await this.reviewsService.create(req.user.id, body);
    await this.auditService.record({
      actorType: 'customer',
      actorId: req.user.id,
      action: 'review.create',
      resourceType: 'review',
      resourceId: review.id,
      metadata: {
        orderId: review.orderId,
        productId: review.productId,
        rating: review.rating,
      },
      request: auditRequestFromHeaders(req.headers, clientIpFromRequest(req)),
    });
    return {
      id: review.id,
      orderId: review.orderId,
      productId: review.productId,
      rating: review.rating,
      body: review.body,
      createdAt: review.createdAt.toISOString(),
    };
  }
}
