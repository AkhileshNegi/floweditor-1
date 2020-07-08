const activity = {
  nodes: {},
  segments: {}
};

const { getOpts } = require('./utils');

exports.handler = (evt, ctx, cb) => {
  console.log(activity);
  cb(null, getOpts({ body: JSON.stringify(activity) }));
};
