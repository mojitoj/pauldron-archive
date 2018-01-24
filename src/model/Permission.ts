export class Permission {
    resource_set_id: any;
    scopes: any[];

    public static validate(object: any): boolean {
        const permission: Permission = object;
        return (permission.resource_set_id
            && permission.scopes
            && permission.scopes instanceof Array);
    }

    public static validateArray (object: any): boolean {
        if (object instanceof Array && object.length > 0) {
            return object.reduce (
                (previousValue: any, currentValue: any, currentIndex: number) => (previousValue && Permission.validate(currentValue)),
                true
            );
        }
        return false;
    }
}