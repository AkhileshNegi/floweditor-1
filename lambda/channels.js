const channels = {
  results: [
    {
      uuid: '0f661e8b-ea9d-4bd3-9953-d368340acf91',
      name: 'WhatsApp',
      address: '+18005234545',
      schemes: ['whatsapp'],
      roles: ['send', 'receive']
    }
  ]
};

const { getOpts } = require('./utils');

exports.handler = (evt, ctx, cb) => cb(null, getOpts({ body: JSON.stringify(channels) }));
