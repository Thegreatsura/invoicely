import { ForbiddenError, InternalServerError } from "@/lib/effect/error/trpc";
import { insertInvoiceQuery } from "@/lib/db-queries/invoice/insertInvoice";
import { authorizedProcedure } from "@/trpc/procedures/authorizedProcedure";
import { createInvoiceSchema } from "@/zod-schemas/invoice/create-invoice";
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from "@/constants/issues";
import { parseCatchError } from "@/lib/neverthrow/parseCatchError";
import { TRPCError } from "@trpc/server";
import { Effect } from "effect";

interface MutationResponse {
  success: boolean;
  message: string;
  invoiceId?: string;
}

export const insertInvoice = authorizedProcedure
  .input(createInvoiceSchema)
  .mutation<MutationResponse>(async ({ ctx, input }) => {
    // Insert Invoice Effect
    const insertInvoiceEffect = Effect.gen(function* () {
      // Check if the user is allowed to save data
      if (!ctx.auth.user.allowedSavingData) {
        return yield* new ForbiddenError({ message: ERROR_MESSAGES.NOT_ALLOWED_TO_SAVE_DATA });
      }

      // Insert the invoice
      const invoiceId = yield* Effect.tryPromise({
        try: () => insertInvoiceQuery(input, ctx.auth.user.id),
        catch: (error) => new InternalServerError({ message: parseCatchError(error) }),
      });

      // Return the success message
      return {
        success: true,
        message: SUCCESS_MESSAGES.INVOICE_SAVED,
        invoiceId,
      };
    });

    // Run the effect
    return Effect.runPromise(
      insertInvoiceEffect.pipe(
        Effect.catchTags({
          // If the user is not allowed to save data, return a forbidden error
          ForbiddenError: (error) => Effect.fail(new TRPCError({ code: "FORBIDDEN", message: error.message })),
          // If the invoice insertion fails, return an internal server error
          InternalServerError: (error) =>
            Effect.fail(new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message })),
        }),
      ),
    );
  });
