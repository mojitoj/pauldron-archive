
function genericErrorHandler(e) {
    if (!e ) {
      throw {
        error: "invalid_response"
      };
    } else if (e.statusCode === 404) {
      throw {
        error: "object_not_found",
        message: e.message
      };
    } else if (e.statusCode === 403 || e.statusCode === 401) {
      throw {
        error: "authorization_error",
        message: e.message
      };
    }
  }

  module.exports= {
    genericErrorHandler
  };
