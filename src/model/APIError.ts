export class APIError {
    message: string;
    error: string;
    status: number;

    constructor(theMessage: string, theErrorCode: string, theStatus: number) {
        this.message = theMessage;
        this.error = theErrorCode;
        this.status = theStatus;
      }
}