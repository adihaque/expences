export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
/** A user-facing problem; `code` is translated by i18n.err() */
export class UserError extends Error { constructor(public code: string, public arg?: string) { super(code); } }
