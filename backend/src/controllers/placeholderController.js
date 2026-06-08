const { ok } = require("../utils/response");

function list(name) {
  return (req, res) => {
    return ok(res, [], `${name} werkt`);
  };
}

function detail(name) {
  return (req, res) => {
    return ok(res, { id: req.params.id }, `${name} detail werkt`);
  };
}

function action(name) {
  return (req, res) => {
    return ok(res, { params: req.params, body: req.body }, `${name} werkt`);
  };
}

module.exports = { list, detail, action };
