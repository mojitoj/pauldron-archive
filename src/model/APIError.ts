export class APIError {
    message: string;
    error: string;
    status: number;
    info: any;

    constructor(theMessage: string, theErrorCode: string, theStatus: number, info: any = null) {
        this.message = theMessage;
        this.error = theErrorCode;
        this.status = theStatus;
        this.info = info;
      }
}