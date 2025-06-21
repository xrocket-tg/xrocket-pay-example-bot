// This file is deprecated - all functions have been moved to UserService
// Please use UserService.getInstance() instead

import { UserService } from "../../services/user";

// Re-export for backward compatibility (will be removed in future)
export const getOrCreateUser = (ctx: any) => UserService.getInstance().findOrCreateUser(ctx);
export const getUserBalances = (user: any) => UserService.getInstance().getUserBalances(user);
export const formatBalanceMessage = (balances: any) => UserService.getInstance().formatBalanceMessage(balances);
export const getUserInvoicesWithPagination = (user: any, page: any, pageSize: any) => UserService.getInstance().getUserInvoicesWithPagination(user, page, pageSize);
export const formatInvoiceDetailMessage = (invoice: any) => UserService.getInstance().formatInvoiceDetailMessage(invoice);
export const displayBalance = (ctx: any, user: any) => UserService.getInstance().displayBalance(ctx, user); 