const { getOpts } = require('./utils');
const templates = [
  {
    uuid: '9c22b594-fcab-4b29-9bcb-ce4404894a80',
    name: 'revive_issue',
    created_on: '2019-04-02T22:14:31.549213Z',
    modified_on: '2019-04-02T22:14:31.569739Z',

    translations: [
      {
        language: 'eng',
        content: 'Hi {{1}}, are you still experiencing problems with {{2}}?',
        variable_count: 2,
        status: 'approved',
        channel: {
          uuid: '0f661e8b-ea9d-4bd3-9953-d368340acf91',
          name: 'WhatsApp'
        }
      },
      {
        language: 'fra',
        content: 'Bonjour {{1}}, a tu des problems avec {{2}}?',
        variable_count: 2,
        status: 'pending',
        channel: {
          uuid: '0f661e8b-ea9d-4bd3-9953-d368340acf91',
          name: 'WhatsApp'
        }
      }
    ]
  }
];

exports.handler = (evt, ctx, cb) =>
  cb(null, getOpts({ body: JSON.stringify({ results: templates }) }));
