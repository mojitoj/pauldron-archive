export class APIError {
    message: string;
    code: string;
    status: number;

    constructor(theMessage: string, theCode: string, theStatus: number) {
        this.message = theMessage;
        this.code = theCode;
        this.status = theStatus;
      }
}