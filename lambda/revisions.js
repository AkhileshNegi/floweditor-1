import { respond } from './utils/index.js';

const user = {
  email: 'chancerton@nyaruka.com',
  name: 'Chancellor von Frankenbean'
};

const assetList = [
  {
    user: user,
    created_on: new Date(),
    id: 1,
    version: '13.0.0',
    revision: 1
  }
];

const defination_2 = {
  name: 'Favorites',
  language: 'eng',
  type: 'message',
  spec_version: '13.1.0',
  uuid: 'a4f64f1b-85bc-477e-b706-de313a022972',
  localization: {},
  nodes: [
    {
      uuid: '3ea030e9-41c4-4c6c-8880-68bc2828d67b',
      actions: [
        {
          attachments: [],
          text:
            'Hello please select your option: \n\n1 Glific objectives\n2 How can Glific help you\n3 Glific website\n4 Opt-out. \n\nPlease just send the number, e.g. 1',
          type: 'send_msg',
          quick_replies: [],
          uuid: 'e319cd39-f764-4680-9199-4cb7da647166'
        }
      ],
      exits: [
        {
          uuid: 'a8311645-482e-4d35-b300-c92a9b18798b',
          destination_uuid: '6f68083e-2340-449e-9fca-ac57c6835876'
        }
      ]
    },
    {
      uuid: '6f68083e-2340-449e-9fca-ac57c6835876',
      actions: [],
      router: {
        type: 'switch',
        default_category_uuid: '65da0a4d-2bcc-42a2-99f5-4c9ed147f8a6',
        cases: [
          {
            arguments: ['1', 'one'],
            type: 'has_any_word',
            uuid: '0345357f-dbfa-4946-9249-5828b58161a0',
            category_uuid: 'de13e275-a05f-41bf-afd8-73e9ed32f3bf'
          },
          {
            arguments: ['2', 'two'],
            type: 'has_any_word',
            uuid: 'bc425dbf-d50c-48cf-81ba-622c06e153b0',
            category_uuid: 'd3f0bf85-dac1-4b7d-8084-5c1ad2575f12'
          },
          {
            arguments: ['3', 'Three'],
            type: 'has_any_word',
            uuid: 'be6bc73d-6108-405c-9f88-c317c05311ad',
            category_uuid: '243766e5-e353-4d65-b87a-4405dbc24b1d'
          },
          {
            arguments: ['4', 'Four'],
            type: 'has_any_word',
            uuid: 'ebacc52f-a9b0-406d-837e-9e5ca1557d17',
            category_uuid: '3ce58365-61f2-4a6c-9b03-1eeccf988952'
          }
        ],
        categories: [
          {
            uuid: 'de13e275-a05f-41bf-afd8-73e9ed32f3bf',
            name: 'One',
            exit_uuid: '744b1082-4d95-40d0-839a-89fc1bb99d30'
          },
          {
            uuid: 'd3f0bf85-dac1-4b7d-8084-5c1ad2575f12',
            name: 'Two',
            exit_uuid: '77cd0e42-6a13-4122-a5fc-84b2e2daa1d4'
          },
          {
            uuid: '243766e5-e353-4d65-b87a-4405dbc24b1d',
            name: 'Three',
            exit_uuid: '0caba4c7-0955-41c9-b8dc-6c58112503a0'
          },
          {
            uuid: '3ce58365-61f2-4a6c-9b03-1eeccf988952',
            name: 'Four',
            exit_uuid: '1da8bf0a-827f-43d8-8222-a3c79bcace46'
          },
          {
            uuid: '65da0a4d-2bcc-42a2-99f5-4c9ed147f8a6',
            name: 'Other',
            exit_uuid: 'd11aaf4b-106f-4646-a15d-d18f3a534e38'
          }
        ],
        operand: '@input.text',
        wait: {
          type: 'msg'
        },
        result_name: 'Result 1'
      },
      exits: [
        {
          uuid: '744b1082-4d95-40d0-839a-89fc1bb99d30',
          destination_uuid: 'f189f142-6d39-40fa-bf11-95578daeceea'
        },
        {
          uuid: '77cd0e42-6a13-4122-a5fc-84b2e2daa1d4',
          destination_uuid: '85e897d2-49e4-42b7-8574-8dc2aee97121'
        },
        {
          uuid: '0caba4c7-0955-41c9-b8dc-6c58112503a0',
          destination_uuid: '6d39df59-4572-4f4c-99b7-f667ea112e03'
        },
        {
          uuid: '1da8bf0a-827f-43d8-8222-a3c79bcace46',
          destination_uuid: '93a3335b-8909-406f-9ea2-af48d7947857'
        },
        {
          uuid: 'd11aaf4b-106f-4646-a15d-d18f3a534e38',
          destination_uuid: null
        }
      ]
    },
    {
      uuid: '93a3335b-8909-406f-9ea2-af48d7947857',
      actions: [
        {
          uuid: 'cb0b1ffc-2a42-4785-946d-a1e9b064b961',
          type: 'enter_flow',
          flow: {
            uuid: '9ecc8e84-6b83-442b-a04a-8094d5de997b',
            name: 'Customer Service'
          }
        }
      ],
      router: {
        type: 'switch',
        operand: '@child.run.status',
        cases: [
          {
            uuid: '300760a1-f94f-48c7-9f83-abb68380b2a5',
            type: 'has_only_text',
            arguments: ['completed'],
            category_uuid: '5af22d80-be8c-4284-bda8-681b98284d3f'
          },
          {
            uuid: '9c452875-79e4-4a8b-9817-1ab15886131f',
            arguments: ['expired'],
            type: 'has_only_text',
            category_uuid: '332d1e71-8d39-4dca-b63b-c5c178f7ff8c'
          }
        ],
        categories: [
          {
            uuid: '5af22d80-be8c-4284-bda8-681b98284d3f',
            name: 'Complete',
            exit_uuid: 'fa763fe5-cdd6-40ea-a06b-790556a50b7e'
          },
          {
            uuid: '332d1e71-8d39-4dca-b63b-c5c178f7ff8c',
            name: 'Expired',
            exit_uuid: '17a47ce6-a762-4690-b1f2-4dbcc99a9caf'
          }
        ],
        default_category_uuid: '332d1e71-8d39-4dca-b63b-c5c178f7ff8c'
      },
      exits: [
        {
          uuid: 'fa763fe5-cdd6-40ea-a06b-790556a50b7e',
          destination_uuid: '3ea030e9-41c4-4c6c-8880-68bc2828d67b'
        },
        {
          uuid: '17a47ce6-a762-4690-b1f2-4dbcc99a9caf',
          destination_uuid: '3ea030e9-41c4-4c6c-8880-68bc2828d67b'
        }
      ]
    },
    {
      uuid: '6d39df59-4572-4f4c-99b7-f667ea112e03',
      actions: [
        {
          attachments: [],
          text: 'https://glific.io/',
          type: 'send_msg',
          quick_replies: [],
          uuid: '10196f43-87f0-4205-aabd-1549aaa7e242'
        }
      ],
      exits: [
        {
          uuid: 'b913ee73-87d2-495b-8a2d-6e7c40f31fd5',
          destination_uuid: null
        }
      ]
    },
    {
      uuid: 'f189f142-6d39-40fa-bf11-95578daeceea',
      actions: [
        {
          attachments: [],
          text:
            'Glific is designed specifically for NGOs in the social sector to enable them to interact with their users on a regular basis',
          type: 'send_msg',
          quick_replies: [],
          uuid: 'ed7d10f7-6298-4d84-a8d2-7b1f6e91da07'
        }
      ],
      exits: [
        {
          uuid: 'd002db23-a51f-4183-81d6-b1e93c5132fb',
          destination_uuid: null
        }
      ]
    },
    {
      uuid: '85e897d2-49e4-42b7-8574-8dc2aee97121',
      actions: [
        {
          attachments: [],
          text:
            'If you are interested in using Glific, let us know. You can find more information on our website',
          type: 'send_msg',
          quick_replies: [],
          uuid: 'a970d5d9-2951-48dc-8c66-ee6833c4b21e'
        }
      ],
      exits: [
        {
          uuid: '37a545df-825b-4611-a7fe-b17dfb62c430',
          destination_uuid: null
        }
      ]
    }
  ],
  _ui: {
    nodes: {
      '3ea030e9-41c4-4c6c-8880-68bc2828d67b': {
        position: {
          left: 600,
          top: 0
        },
        type: 'execute_actions'
      },
      '6f68083e-2340-449e-9fca-ac57c6835876': {
        type: 'wait_for_response',
        position: {
          left: 120,
          top: 300
        },
        config: {
          cases: {}
        }
      },
      'f189f142-6d39-40fa-bf11-95578daeceea': {
        position: {
          left: 0,
          top: 500
        },
        type: 'execute_actions'
      },
      '85e897d2-49e4-42b7-8574-8dc2aee97121': {
        position: {
          left: 340,
          top: 520
        },
        type: 'execute_actions'
      },
      '6d39df59-4572-4f4c-99b7-f667ea112e03': {
        position: {
          left: 740,
          top: 460
        },
        type: 'execute_actions'
      },
      '93a3335b-8909-406f-9ea2-af48d7947857': {
        type: 'split_by_subflow',
        position: {
          left: 1020,
          top: 400
        },
        config: {}
      }
    },
    languages: [
      {
        eng: 'English'
      },
      {
        spa: 'Spanish'
      }
    ]
  }
};

const assetContent = {
  1: {
    definition: defination_2,
    metadata: {
      issues: []
    }
  }
};

const getIssues = definition => {
  const issues = [];
  for (const node of definition.nodes) {
    if (JSON.stringify(node).indexOf('missing_field') > -1) {
      const issue = {
        type: 'missing_dependency',
        description: 'missing field dependency',
        node_uuid: node.uuid,
        dependency: {
          name: 'Missing Field',
          key: 'missing_field',
          type: 'field'
        }
      };

      for (const action of node.actions) {
        if (JSON.stringify(action).indexOf('missing_field') > -1) {
          issue.action_uuid = action.uuid;
        }
      }
      issues.push(issue);
    }
  }
  return issues;
};

exports.handler = (request, context, callback) => {
  console.log('request', request);

  if (request.httpMethod === 'POST') {
    const id = Object.keys(assetContent).length + 1;
    console.log('ID', id);

    const definition = JSON.parse(request.body);

    let issues = [];
    if (request.body.indexOf('missing_field') > 0) {
      issues = getIssues(definition);
    }

    // save our response for browser reloads
    assetContent[id] = { definition: definition, metadata: { issues } };

    const asset = {
      user: user,
      created_on: new Date(),
      id,
      version: '13.0.0',
      revision: id,
      metadata: {
        issues
      }
    };

    assetList.unshift(asset);
    respond(callback, asset);
    return;
  }

  const regex = /.*\/revisions\/(\d+)/;
  const match = regex.exec(request.path);

  if (match && match.length > 1) {
    let body = JSON.stringify(assetContent[match[1]], null, 1);
    respond(callback, assetContent[match[1]]);
  } else {
    respond(callback, { results: assetList });
  }
};
