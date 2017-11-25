export class Permission {
    resource_id: string;
    resource_scopes: string[];

    public static validate(object: any): boolean {
        const permission: Permission = object;        
        if (permission.resource_id 
            && permission.resource_scopes
            && permission.resource_scopes instanceof Array) {
             return true;
          }
        return false;
    }

    public static validateArray (object: any): boolean {
        if (object instanceof Array && object.length > 0) {
            return object.reduce(
                (previousValue:any, currentValue:any, currentIndex:number) => (previousValue && Permission.validate(currentValue)),
                true
            );
        }
        return false;
    }
}