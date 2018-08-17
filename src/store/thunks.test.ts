/* import mutate from 'immutability-helper';
import { ghost } from '~/components/flow/node/Node.scss';
import { Operators } from '~/config/operatorConfigs';
import { getTypeConfig, Types } from '~/config/typeConfigs';
import { AnyAction, FlowDefinition, RouterTypes, SendMsg, SwitchRouter } from '~/flowTypes';
import AssetService from '~/services/AssetService';
import Constants from '~/store/constants';
import { RenderNode, RenderNodeMap } from '~/store/flowContext';
import { getFlowComponents, getNodeWithAction, getUniqueDestinations } from '~/store/helpers';
import { NodeEditorSettings } from '~/store/nodeEditor';
import { initialState } from '~/store/state';
import {
    addNode,
    disconnectExit,
    ensureStartNode,
    handleTypeConfigChange,
    initializeFlow,
    LocalizationUpdates,
    moveActionUp,
    onAddToNode,
    onConnectionDrag,
    onNodeMoved,
    onOpenNodeEditor,
    onResetDragSelection,
    onUpdateAction,
    onUpdateLocalizations,
    onUpdateRouter,
    reflow,
    removeAction,
    removeNode,
    resetNodeEditingState,
    spliceInRouter,
    updateConnection,
    updateDimensions,
    updateExitDestination,
    updateSticky
} from '~/store/thunks';
import { createMockStore, mock, prepMockDuxState } from '~/testUtils';
import { createAddGroupsAction, createSendMsgAction } from '~/testUtils/assetCreators';
import * as utils from '~/utils';

const config = require('~/test/config');

const boring: FlowDefinition = require('~/test/flows/boring.json');
const getUpdatedNodes = (currentStore: any): { [uuid: string]: RenderNode } => {
    let nodes;
    // return the last action for UPDATE_NODES
    for (const action of currentStore.getActions()) {
        if (action.type === Constants.UPDATE_NODES) {
            nodes = action.payload.nodes;
        }
    }
    return nodes;
};

describe('fetch flows', () => {
    const store = createMockStore({});
});

describe('Flow Manipulation', () => {
    let store: any;
    const { mockDuxState, testNodes } = prepMockDuxState();

    beforeEach(() => {
        // prep our store to show that we are editing
        store = createMockStore(mockDuxState);
        mock(utils, 'createUUID', utils.seededUUIDs());
    });

    describe('init', () => {
        it('should initialize definition', () => {
            const assetService = new AssetService(config);
            const { renderNodeMap, groups, fields } = store.dispatch(
                initializeFlow(boring, assetService, [])
            );
            expect(renderNodeMap).toMatchSnapshot('nodes');
            expect(store).toHaveReduxActions([Constants.UPDATE_NODES]);
        });

        it('should update localizations', () => {
            const updatedStore = createMockStore({
                flowContext: { definition: boring }
            });
            const localizationUpdates: LocalizationUpdates = [
                {
                    uuid: 'node0_action0',
                    translations: { text: ['espanols'] }
                }
            ];

            const updated: FlowDefinition = updatedStore.dispatch(
                onUpdateLocalizations('spa', localizationUpdates)
            );

            expect(updated.localization.spa.node0_action0).toEqual({ text: ['espanols'] });
        });
    });

    describe('stickies', () => {
        it('should add new stickies', () => {
            const newSticky = {
                title: 'Sticky A',
                body: 'The body for sticky A',
                position: { left: 100, top: 100 }
            };

            store.dispatch(updateSticky('stickyA', newSticky));

            // should see our new sticky note
            boring._ui.stickies = { stickyA: newSticky };

            expect(store).toHavePayload(Constants.UPDATE_DEFINITION, { definition: boring });
        });

        it('should add stickies to definitions with none', () => {
            delete boring._ui.stickies;
            store = createMockStore({
                flowContext: { definition: boring }
            });

            const newSticky = {
                title: 'sticky0',
                body: 'The body for sticky0',
                position: { left: 100, top: 100 }
            };

            store.dispatch(updateSticky('sticky0', newSticky));

            // should see our new sticky note
            boring._ui.stickies = { sticky0: newSticky };
            expect(store).toHavePayload(Constants.UPDATE_DEFINITION, { definition: boring });
        });

        it('should remove stickies if null is passed', () => {
            boring._ui.stickies = {
                sticky0: {
                    title: 'sticky0',
                    body: 'The body for sticky0',
                    position: { left: 100, top: 100 }
                }
            };

            store = createMockStore({
                flowContext: { definition: boring }
            });

            store.dispatch(updateSticky('sticky0', null));

            // should be back to an empty flow
            boring._ui.stickies = {};
            expect(store).toHavePayload(Constants.UPDATE_DEFINITION, { definition: boring });
        });
    });

    describe('nodes', () => {
        it('should reflow nodes', () => {
            // make our nodes collide
            const collidingNodes = mutate(testNodes, {
                node1: {
                    ui: { position: { $merge: { top: testNodes.node1.ui.position.top - 50 } } }
                }
            });

            // prep our store to show that we are editing
            const updatedStore = createMockStore({
                flowContext: {
                    nodes: collidingNodes
                }
            });

            // forcing a reflow should bump us down where we don't collide
            const updated = updatedStore.dispatch(reflow());
            expect(updated.node1.ui.position.top).toBe(260);
        });

        it('should cascade reflow', () => {
            // make our nodes have a cascading collision
            const collidingNodes = mutate(testNodes, {
                node1: {
                    ui: { position: { $merge: { top: testNodes.node1.ui.position.top - 50 } } }
                },
                node2: {
                    ui: { position: { $merge: { top: testNodes.node2.ui.position.top - 50 } } }
                }
            });

            // prep our store to show that we are editing
            const updatedStore = createMockStore({
                flowContext: {
                    nodes: collidingNodes
                }
            });

            // forcing a reflow should bump us down where we don't collide
            const updated = updatedStore.dispatch(reflow());
            expect(updated.node1.ui.position.top).toBe(260);

            // and we should have cascaded to the third node
            expect(updated.node2.ui.position.top).toBe(420);
            expect(updatedStore.getActions().length).toBe(1);
        });

        it('should move nodes', () => {
            const nodes = store.dispatch(
                onNodeMoved(testNodes.node0.node.uuid, { left: 500, top: 600 })
            );

            expect(nodes.node0.ui.position).toEqual({
                left: 500,
                top: 600,
                right: 720,
                bottom: 854
            });
        });

        it('should clear the drag selection when a node is moved', () => {
            // prep our store to show that we are editing
            store = createMockStore({
                flowContext: { nodes: testNodes },
                editorState: { dragSelection: { selected: { nodeA: true } } },
                nodeEditor: { settings: null }
            });

            store.dispatch(onNodeMoved(testNodes.node0.node.uuid, { left: 500, top: 600 }));
            expect(store).toHavePayload(Constants.UPDATE_EDITOR_STATE, {
                editorState: {
                    dragSelection: {
                        selected: null
                    }
                }
            });
        });

        it('should clear drag selection', () => {
            // prep our store to show that we are editing
            store = createMockStore({
                flowContext: { nodes: testNodes },
                editorState: { dragSelection: { selected: { nodeA: true } } },
                nodeEditor: { settings: null }
            });

            store.dispatch(onResetDragSelection());
            expect(store).toHavePayload(Constants.UPDATE_EDITOR_STATE, {
                editorState: {
                    dragSelection: {
                        selected: null
                    }
                }
            });
        });

        it('should store a pending connection when starting a drag', () => {
            // mock(utils, 'createUUID', utils.seededUUIDs());
            store.dispatch(
                onConnectionDrag({
                    connection: null,
                    endpoints: null,
                    suspendedElementId: null,
                    target: null,
                    targetId: null,
                    source: null,
                    sourceId: 'node0:node0_exit0'
                })
            );
            expect(store.getActions()).toMatchSnapshot();
        });

        it('should update dimensions', () => {
            const updated = store.dispatch(
                updateDimensions(testNodes.node0.node, { width: 300, height: 600 })
            );

            expect(updated.node0.ui.position).toEqual({
                left: 0,
                top: 0,
                right: 300,
                bottom: 600
            });
        });

        it('should create a start node if needed', () => {
            // if there are already nodes, we're a noop
            expect(store.dispatch(ensureStartNode())).toBeUndefined();

            // create a store without nodes
            const updatedStore = createMockStore({
                flowContext: { nodes: {} }
            });

            // now we create a new one
            const newNode = updatedStore.dispatch(ensureStartNode());
            expect(newNode.node.actions[0].text).toBe(
                'Hi there, this is the first message in your flow.'
            );
        });

        describe('removal', () => {
            it('should remove it from the map', () => {
                const nodes = store.dispatch(removeNode(testNodes.node1.node));
                expect(nodes.node1).toBeUndefined();
            });

            it('should remove pointers from its destination', () => {
                const nodes = store.dispatch(removeNode(testNodes.node0.node));
                const destinations = getUniqueDestinations(testNodes.node0.node);
                expect(destinations.length).toBe(1);

                // we were the only thing pointing to our friends, so now they
                // should have no inbound connections
                for (const nodeUUID of destinations) {
                    expect(nodes[nodeUUID]).not.toHaveInboundConnections();
                }
            });

            it('should reroute pass through connections', () => {
                const nodes = store.dispatch(removeNode(testNodes.node2.node));

                // we reomved 2, so now 1 should point to 3
                expect(nodes.node1).toHaveExitThatPointsTo(nodes.node3);

                // and the next node in the tree should reflect our inbound connection
                expect(nodes.node3).toHaveInboundFrom(testNodes.node1.node.exits[0]);
            });

            // test a snapshot after removing each node in the flow
            for (const nodeUUID of Object.keys(testNodes)) {
                it('should remove node ' + nodeUUID, () => {
                    const nodes = store.dispatch(removeNode(testNodes[nodeUUID].node));
                    expect(nodes).toMatchSnapshot('Remove ' + nodeUUID);
                });
            }

            it("should remove node's result name from our results completion option map", () => {
                const { resultMap, renderNodeMap } = getFlowComponents(boring);
                const expectedResultNames = mutate(resultMap, {
                    $unset: [testNodes.node1.node.uuid]
                });

                // Store should have result completion option map
                store = createMockStore(
                    mutate(initialState, {
                        flowContext: {
                            nodes: { $set: renderNodeMap },
                            results: {
                                resultMap: { $set: resultMap }
                            }
                        }
                    })
                );

                store.dispatch(removeNode(testNodes.node1.node));

                expect(store).toHavePayload(Constants.UPDATE_RESULT_MAP, {
                    resultMap: expectedResultNames
                });
            });
        });
    });

    describe('connections', () => {
        it('should updateExitDestination()', () => {
            const updated = store.dispatch(updateExitDestination('node0', 'node0_exit0', 'node2'));
            expect(updated.node0).toHaveExitThatPointsTo(updated.node2);
        });

        it('should disconnectExit()', () => {
            const updated = store.dispatch(disconnectExit('node0', 'node0_exit0'));
            expect(updated.node0).not.toHaveExitWithDestination();
        });

        it('should updateConnection()', () => {
            const updated = store.dispatch(updateConnection('node0:node0_exit0', 'node2'));
            expect(updated.node0).toHaveExitThatPointsTo(updated.node2);
        });

        it('should throw if attempting to connect node to itself', () => {
            expect(() => {
                store.dispatch(updateConnection('node0:node0_exit0', 'node0'));
            }).toThrowError('Cannot connect node0 to itself');
        });

        it('should update connections when adding a node', () => {
            let fromNode = testNodes.node3;
            const fromNodeUUID = fromNode.node.uuid;
            const fromExitUUID = fromNode.node.exits[0].uuid;

            const addedNode = store.dispatch(
                addNode({
                    node: { uuid: null, actions: [], exits: [] },
                    ui: { position: { left: 200, top: 200 } },
                    inboundConnections: {
                        [fromExitUUID]: fromNodeUUID
                    }
                })
            );

            const nodes = getUpdatedNodes(store);
            fromNode = nodes[fromNodeUUID];

            // our pointing node should be directed at us
            expect(fromNode).toHaveExitThatPointsTo(addedNode);
            expect(addedNode).toHaveInboundFrom(fromNode.node.exits[0]);
        });
    });

    describe('actions', () => {
        it('should add new action', () => {
            // prep our store to show that we are editing
            const updatedStore = createMockStore({
                ...store.getState(),
                nodeEditor: {
                    userAddingAction: true,
                    settings: { originalNode: testNodes.node0 }
                }
            });

            // add a new message to the first node
            const nodes = updatedStore.dispatch(
                onUpdateAction({
                    uuid: 'new_action',
                    type: Types.send_msg,
                    text: 'A fifth action for our first node'
                })
            );

            // we should have a new action
            const actions = nodes.node0.node.actions;
            expect(actions.length).toBe(5);
            expect((actions[4] as SendMsg).text).toBe('A fifth action for our first node');
        });

        it('should replace router node with a single-action node', () => {
            const { node1: originalRenderNode } = testNodes;
            const incomingAction = createSendMsgAction();
            const { renderNodeMap } = getFlowComponents(boring);

            store = createMockStore(
                mutate(initialState, {
                    flowContext: {
                        nodes: { $set: renderNodeMap }
                    },
                    nodeEditor: {
                        settings: { $set: { originalNode: originalRenderNode } }
                    }
                })
            );

            const updatedNodes = store.dispatch(onUpdateAction(incomingAction));
            const node = getNodeWithAction(updatedNodes, incomingAction.uuid);
            expect(node).toMatchSnapshot();
        });

        it('should throw if originalNode is null', () => {
            expect(() => {
                // add a new message to the first node
                const nodes = store.dispatch(
                    onUpdateAction({
                        uuid: 'new_action',
                        type: Types.send_msg,
                        text: 'A second message for our first node'
                    })
                );
            }).toThrowError('Need originalNode in settings to update an action');
        });

        it('should update an existing action', () => {
            // prep our store to show that we are editing
            const updatedStore = createMockStore({
                ...store.getState(),
                nodeEditor: {
                    userAddingAction: false,
                    settings: { originalNode: testNodes.node0 }
                }
            });

            // add a new message to the first node
            const nodes = updatedStore.dispatch(
                onUpdateAction({
                    uuid: 'node0_action0',
                    type: 'send_msg',
                    text: 'An updated message'
                } as AnyAction)
            );

            expect(nodes.node0.node.actions[0].text).toBe('An updated message');
        });

        it('should remove the node when removing the last action', () => {
            // remove the first action
            const updated = store.dispatch(removeAction('node3', testNodes.node3.node.actions[0]));

            // first one was removed, so now actionB is first
            expect(updated.node3).toBeUndefined();
        });

        it('should remove an action from a list of actions', () => {
            // remove the first action
            const updated = store.dispatch(removeAction('node0', testNodes.node0.node.actions[0]));

            // first one was removed, so now second action is first
            expect(updated.node0.node.actions[0].uuid).toBe('node0_action1');
        });

        it('should move an action up', () => {
            // add a second action so we can test single action removal
            const updated = store.dispatch(moveActionUp('node0', testNodes.node0.node.actions[1]));
            expect(updated.node0.node.actions[0].uuid).toBe('node0_action1');
        });

        it('should create a new node if needed for new action', () => {
            // prep our store to show that we are editing
            const updatedStore = createMockStore({
                ...store.getState(),
                nodeEditor: {
                    userAddingAction: true,
                    settings: {
                        originalNode: {
                            node: { uuid: utils.createUUID() },
                            ui: { position: { left: 500, top: 500 } },
                            inboundConnections: { node3_exit0: 'node3' },
                            ghost: true
                        }
                    }
                }
            });

            const newAction = {
                uuid: 'new_action_for_new_node',
                type: Types.send_msg,
                text: 'An action for a new node'
            } as SendMsg;

            const updated = updatedStore.dispatch(onUpdateAction(newAction));
            const newNodeUUID = updated.node3.node.exits[0].destination_node_uuid;
            expect(newNodeUUID).not.toBeUndefined();

            const newNode = updated[newNodeUUID];
            expect(newNode.ui.position).toEqual({ left: 500, top: 500 });
            expect(newNode.inboundConnections.node3_exit0).toBe('node3');
            expect(newNode.node.actions[0].uuid).toBe('new_action_for_new_node');
        });

        describe('splicing', () => {
            const addRouter = (
                currentStore: any,
                renderNode: RenderNode,
                action: AnyAction
            ): RenderNodeMap => {
                const newExitUUID = utils.createUUID();
                const newNode: RenderNode = {
                    node: {
                        actions: [],
                        router: {
                            type: RouterTypes.switch,
                            cases: [],
                            default_exit_uuid: newExitUUID
                        } as SwitchRouter,
                        uuid: utils.createUUID(),
                        exits: [
                            {
                                uuid: newExitUUID,
                                destination_node_uuid: null
                            }
                        ]
                    },
                    ui: {
                        position: { left: 100, top: 100 },
                        type: Types.wait_for_response
                    },
                    inboundConnections: {}
                };

                const previousAction = { nodeUUID: renderNode.node.uuid, actionUUID: action.uuid };
                return currentStore.dispatch(spliceInRouter(newNode, previousAction));
            };

            it('should replace the first action of two', () => {
                const nodes = addRouter(store, testNodes.node2, testNodes.node2.node.actions[0]);
                const topNode = nodes[nodes.node1.node.exits[0].destination_node_uuid];
                const bottomNode = nodes[topNode.node.exits[0].destination_node_uuid];

                // top node should point to the middle node, and middle should point back
                expect(topNode.inboundConnections).toEqual(testNodes.node2.inboundConnections);

                // bottom node should point back to top node
                expect(bottomNode).toHaveInboundFrom(topNode.node.exits[0]);

                // bottom node should point to the same place as original node
                expect(bottomNode).toHaveExitThatPointsTo(nodes.node3);

                // original node should be gonezor
                expect(nodes[testNodes.node2.node.uuid]).toBeUndefined();
            });

            it('should replace the second action of two', () => {
                const nodes = addRouter(store, testNodes.node2, testNodes.node2.node.actions[1]);
                const topNode = nodes[nodes.node1.node.exits[0].destination_node_uuid];
                const bottomNode = nodes[topNode.node.exits[0].destination_node_uuid];

                expect(topNode.node.exits[0]).toPointTo(bottomNode);
                expect(bottomNode).toHaveInboundFrom(topNode.node.exits[0]);
            });

            it('should replace the second action of three', () => {
                const nodes = addRouter(store, testNodes.node0, testNodes.node0.node.actions[1]);

                // find our top node by position since it's uuid will be different
                const topNodeUUID = Object.keys(nodes).find((key: string) => {
                    return nodes[key].ui.position.top === 0;
                });

                const topNode = nodes[topNodeUUID];
                const middleNode = nodes[topNode.node.exits[0].destination_node_uuid];
                const bottomNode = nodes[middleNode.node.exits[0].destination_node_uuid];

                // top node should point to the middle node, and middle should point back
                expect(middleNode).toHaveInboundFrom(topNode.node.exits[0]);

                // middle should point to the bottom, and bottom should point back
                expect(bottomNode).toHaveInboundFrom(middleNode.node.exits[0]);

                // original node should be gonezor
                expect(nodes.node0).toBeUndefined();
            });
        });
    });

    describe('node editor', () => {
        beforeEach(() => {
            // now try a store with all the things set
            store = createMockStore(
                mutate(initialState, {
                    flowContext: { nodes: { $set: testNodes }, definition: { $set: boring } },
                    nodeEditor: { settings: { $set: { originalNode: null } } }
                })
            );
        });

        describe('translation', () => {
            it('should edit in translation mode', () => {
                store = createMockStore(
                    mutate(initialState, {
                        flowContext: {
                            definition: { $set: boring },
                            nodes: { $set: testNodes }
                        },
                        editorState: {
                            language: { $set: { iso: 'spa' } },
                            translating: { $set: false }
                        },
                        nodeEditor: {
                            settings: {
                                $set: {
                                    originalNode: null
                                }
                            }
                        }
                    })
                );

                store.dispatch(
                    onOpenNodeEditor({
                        originalNode: testNodes.node0,
                        originalAction: testNodes.node0.node.actions[0],
                        showAdvanced: false
                    })
                );
            });

            it('should pick your action for you if necessary', () => {
                store = createMockStore(
                    mutate(initialState, {
                        flowContext: { nodes: { $set: testNodes }, definition: { $set: boring } },
                        editorState: {
                            language: { $set: { iso: 'spa' } },
                            translating: { $set: true }
                        },
                        nodeEditor: { settings: { $set: { originalNode: null } } }
                    })
                );

                store.dispatch(
                    onOpenNodeEditor({ originalNode: testNodes.node3, showAdvanced: false })
                );
            });

            it('should only pick send_msg actions for you when translating', () => {
                store = createMockStore(
                    mutate(initialState, {
                        flowContext: { nodes: { $set: testNodes }, definition: { $set: boring } },
                        editorState: {
                            language: { $set: { iso: 'spa' } },
                            translating: { $set: true }
                        },
                        nodeEditor: { settings: { $set: { originalNode: null } } }
                    })
                );

                store.dispatch(
                    onOpenNodeEditor({ originalNode: testNodes.node2, showAdvanced: false })
                );
                expect(store).not.toHaveReduxActions([Constants.UPDATE_DEFINITION]);
            });
        });

        describe('normal editing', () => {
            it('should update type config', () => {
                const newTypeConfig = getTypeConfig(Types.add_contact_groups);
                const newActionToEdit = createAddGroupsAction();
                const settings = {
                    originalNode: null,
                    originalAction: newActionToEdit
                } as NodeEditorSettings;

                store = createMockStore(
                    mutate(initialState, {
                        nodeEditor: { $merge: { settings } }
                    })
                );

                store.dispatch(handleTypeConfigChange(newTypeConfig));
                expect(store).toHaveReduxActions([Constants.UPDATE_TYPE_CONFIG]);
                expect(store).toHavePayload(Constants.UPDATE_TYPE_CONFIG, {
                    typeConfig: newTypeConfig
                });
            });

            it('should generate a suggested result name', () => {
                const { renderNodeMap, resultMap } = getFlowComponents(boring);
                const newTypeConfig = getTypeConfig(Types.wait_for_response);
                const {
                    nodes: [originalNode]
                } = boring;
                const {
                    actions: [originalAction]
                } = originalNode;
                const suggestedNameCount = Object.keys(resultMap).length;

                store = createMockStore(
                    mutate(initialState, {
                        flowContext: {
                            nodes: { $set: renderNodeMap },
                            results: {
                                suggestedNameCount: { $set: suggestedNameCount }
                            }
                        },
                        nodeEditor: {
                            settings: {
                                $set: {
                                    originalNode
                                }
                            }
                        }
                    })
                );

                // store.dispatch(handleTypeConfigChange(newTypeConfig, originalAction));
                // expect(store).toHaveReduxActions(expectedActions);
            });

            it('should edit an existing action', () => {
                store.dispatch(
                    onOpenNodeEditor({
                        originalNode: testNodes.node0,
                        originalAction: testNodes.node0.node.actions[0],
                        showAdvanced: false
                    })
                );
            });

            it('should pick the last action if none are provided', () => {
                store.dispatch(
                    onOpenNodeEditor({ originalNode: testNodes.node3, showAdvanced: false })
                );
            });

            it('should throw if no action is provided on an actionless node', () => {
                testNodes.node0.node.actions = [];
                expect(() => {
                    store.dispatch(
                        onOpenNodeEditor({
                            originalNode: testNodes.node0,
                            showAdvanced: false
                        })
                    );
                }).toThrowError("Couldn't determine type config for: node0");
            });

            it('should edit router nodes', () => {
                store.dispatch(
                    onOpenNodeEditor({ originalNode: testNodes.node1, showAdvanced: false })
                );

                expect(store.getActions()).toMatchSnapshot();
            });
        });

        describe('opening and closing', () => {
            it('should open the editor in add to node mode', () => {
                store.dispatch(onAddToNode(testNodes.node0.node));

                expect(store).toHavePayload(Constants.UPDATE_USER_ADDING_ACTION, {
                    userAddingAction: true
                });
            });

            it('should only update things that are set', () => {
                store.dispatch(resetNodeEditingState());
                expect(store.getActions()).toMatchSnapshot();
            });

            it('should reset the node editor', () => {
                // now try a store with all the things set
                store = createMockStore({
                    flowContext: { nodes: testNodes },
                    nodeEditor: { settings: {} },
                    editorState: {}
                });

                store.dispatch(resetNodeEditingState());
                expect(store.getActions()).toMatchSnapshot();
            });
        });
    });

    describe('routers', () => {
        it('should edit an existing router', () => {
            store = createMockStore(
                mutate(initialState, {
                    flowContext: { nodes: { $set: testNodes } },
                    nodeEditor: { settings: { $set: { originalNode: testNodes.node1 } } }
                })
            );

            const updatedNode = mutate(testNodes.node1, {
                node: {
                    router: {
                        cases: utils.push([
                            {
                                uuid: 'new_case',
                                type: Operators.has_any_word,
                                exit_uuid: 'exitD',
                                arguments: ['anotherrule']
                            }
                        ])
                    }
                }
            });
            const previousTop = testNodes.node1.ui.position.top;
            const nodes = store.dispatch(onUpdateRouter(updatedNode));
            const newCase = nodes.node1.node.router.cases[2];

            expect(newCase.arguments).toEqual(['anotherrule']);
            expect(nodes.node1.ui.position.top).toBe(previousTop);
        });

        it('should create a new router on drag', () => {
            const node = mutate(testNodes.node3, {
                inboundConnections: { $set: { node2_exit0: 'node2' } },
                ui: { $merge: { position: { left: 500, top: 600 } } },
                ghost: utils.setTrue()
            });

            store = createMockStore(
                mutate(initialState, {
                    flowContext: { nodes: { $set: testNodes } },
                    nodeEditor: { settings: { $set: { originalNode: node } } }
                })
            );

            const newRouter: RenderNode = {
                node: { uuid: 'new_router', actions: [], exits: [] },
                ui: { position: null },
                inboundConnections: {}
            };

            // add our router
            const nodes = store.dispatch(onUpdateRouter(newRouter));

            // make sure things are wired up as expected
            const newNode = nodes[nodes.node2.node.exits[0].destination_node_uuid];
            expect(newNode).toHaveInboundFrom(nodes.node2.node.exits[0]);
            expect(nodes.node2.node.exits[0]).toPointTo(newNode);
            expect(newNode.ui.position).toEqual({ left: 500, top: 600 });
        });

        it('should update an action into a router', () => {
            store = createMockStore(
                mutate(initialState, {
                    flowContext: { nodes: { $set: testNodes } },
                    nodeEditor: {
                        settings: {
                            $set: {
                                originalAction: testNodes.node3.node.actions[0],
                                originalNode: testNodes.node3
                            }
                        }
                    }
                })
            );

            const newRouter: RenderNode = {
                node: {
                    uuid: testNodes.node3.node.uuid,
                    actions: [],
                    exits: [{ uuid: 'new_exit', destination_node_uuid: null }],
                    router: {
                        type: RouterTypes.switch
                    }
                },
                ui: { position: null },
                inboundConnections: {}
            };

            // splice in our new router
            const nodes = store.dispatch(onUpdateRouter(newRouter));

            // old node should be gone
            expect(nodes.node3).toBeUndefined();
        });

        it('should append a router after an add action', () => {
            store = createMockStore(
                mutate(initialState, {
                    flowContext: { nodes: { $set: testNodes } },
                    nodeEditor: {
                        settings: { $set: { originalNode: testNodes.node0 } }
                    }
                })
            );

            const newRouter: RenderNode = {
                node: {
                    uuid: 'new_router',
                    actions: [],
                    router: {
                        default_exit_uuid: 'new_exit'
                    } as SwitchRouter,
                    exits: [{ uuid: 'new_exit', destination_node_uuid: null }]
                },
                ui: { position: null },
                inboundConnections: {}
            };

            const previousBottom = testNodes.node0.ui.position.bottom;

            // splice in our new router
            const nodes = store.dispatch(onUpdateRouter(newRouter));
            const newNodeUUID = nodes.node0.node.exits[0].destination_node_uuid;
            expect(nodes[newNodeUUID]).toHaveInboundFrom(nodes.node0.node.exits[0]);
        });
    });
});
*/
