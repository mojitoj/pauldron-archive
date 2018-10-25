const Permission = require("../model/Permission");
const TimeStampedPermission = require("../model/TimeStampedPermission");

const APIAuthorization = require("../lib/api-authorization");
const GenericErrorHandler = require("./error-handler");
const _ = require("lodash");
const db = require("../lib/db");

function validatePermissionCreationParams(object) {
  if (!Permission.validate(object)) {
    throw {
      error: "bad_request",
      message: "Bad Request. Expecting a Permissin or Permission array."
    };
  }
}
  
async function list(req, res, next) {
  try {
    const user = APIAuthorization.validate(req, ["PERMS:L"]);
    const thisUsersPermissions = await db.Permissions.list(user);
    res
      .status(200)
      .send(Object.keys(thisUsersPermissions).map((id) => (thisUsersPermissions[id])));
  } catch (e) {
    GenericErrorHandler.handle(e, res, req);
  }
}

const permissionTicketTTL = parseInt(process.env.PERMISSION_TICKET_TTL) || 20;

async function create(req, res, next) {
  try {
    const user = APIAuthorization.validate(req, ["PERMS:C"]);

    validatePermissionCreationParams(req.body);
    const ticket = TimeStampedPermission.issue(permissionTicketTTL, req.body, user);
    await db.Permissions.add(user, ticket.id, ticket);
    res.status(201).send({ticket: ticket.id});
  } catch (e) {
    GenericErrorHandler.handle(e, res, req);
  }
}

module.exports = {
  list, 
  create
};
