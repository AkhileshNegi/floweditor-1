import {
    Action,
    AnyAction,
    Dimensions,
    Exit,
    FlowDefinition,
    FlowNode,
    RouterTypes,
    StickyNote,
    SwitchRouter
} from '~/flowTypes';
import { Asset } from '~/services/AssetService';
import { RenderNode, RenderNodeMap } from '~/store/flowContext';
import { getActionIndex, getExitIndex, getNode } from '~/store/helpers';
import { NodeEditorSettings } from '~/store/nodeEditor';
import { createUUID, merge, NODE_SPACING, push, set, snapToGrid, splice, unset } from '~/utils';

export type LocalizationUpdates = Array<{ uuid: string; translations?: any }>;

const mutate = require('immutability-helper');

export const uniquifyNode = (newNode: FlowNode): FlowNode => {
    // Give our node a unique uuid
    return mutate(newNode, merge({ uuid: createUUID() }));
};

export const getDefaultExit = (node: FlowNode) => {
    if (node.router.type === RouterTypes.switch) {
        const switchRouter = node.router as SwitchRouter;
        return node.exits.find(exit => exit.uuid === switchRouter.default_exit_uuid);
    }
};

/**
 * Update the destination for a specific exit. Updates destination_node_uuid and
 * the inboundConnections for the given node
 * @param nodes
 * @param fromNodeUUID
 * @param fromExitUUID
 * @param destination
 */
export const updateConnection = (
    nodes: RenderNodeMap,
    fromNodeUUID: string,
    fromExitUUID: string,
    destinationNodeUUID: string
): RenderNodeMap => {
    let updatedNodes = nodes;
    const fromNode = getNode(nodes, fromNodeUUID);

    // make sure our destination exits if they provided one
    if (destinationNodeUUID) {
        getNode(nodes, destinationNodeUUID);
    }

    if (fromNodeUUID === destinationNodeUUID) {
        throw new Error('Cannot connect ' + fromNodeUUID + ' to itself');
    }

    const exitIdx = getExitIndex(fromNode.node, fromExitUUID);
    const previousDestination = fromNode.node.exits[exitIdx].destination_node_uuid;

    updatedNodes = mutate(updatedNodes, {
        [fromNodeUUID]: {
            node: {
                exits: {
                    [exitIdx]: {
                        destination_node_uuid: set(destinationNodeUUID)
                    }
                }
            }
        }
    });

    // update our pointers
    if (destinationNodeUUID) {
        updatedNodes = mutate(updatedNodes, {
            [destinationNodeUUID]: {
                inboundConnections: merge({ [fromExitUUID]: fromNodeUUID })
            }
        });
    }

    if (previousDestination != null) {
        updatedNodes = mutate(updatedNodes, {
            [previousDestination]: { inboundConnections: unset([[fromExitUUID]]) }
        });
    }

    return updatedNodes;
};

export const addLanguage = (languages: Asset[], language: Asset): Asset[] => {
    return mutate(languages, push([language]));
};

/**
 * Removes a spcific destination for an exit and the associated inboundConnection.
 * @param nodes
 * @param fromNodeUUID
 * @param fromExitUUID
 */
export const removeConnection = (
    nodes: RenderNodeMap,
    fromNodeUUID: string,
    fromExitUUID: string
): RenderNodeMap => {
    return updateConnection(nodes, fromNodeUUID, fromExitUUID, null);
};

/**
 * Adds a given RenderNode to our node map or updates an existing one.
 * Updates destinations for any inboundConnections provided and updates
 * inboundConnections for any destination_node_uuid our exits point to.
 * @param nodes
 * @param node the node to add, if unique uuid, it will be added
 */
export const mergeNode = (nodes: RenderNodeMap, node: RenderNode): RenderNodeMap => {
    let updatedNodes = nodes;

    // if the node is already there, remove it first
    if (updatedNodes[node.node.uuid]) {
        updatedNodes = removeNode(nodes, node.node.uuid);
    }

    // add our node updted node
    updatedNodes = mutate(nodes, merge({ [node.node.uuid]: node }));

    // if we have inbound connections, update our nodes accordingly
    for (const fromExitUUID of Object.keys(node.inboundConnections)) {
        const fromNodeUUID = node.inboundConnections[fromExitUUID];

        const fromNode = getNode(nodes, fromNodeUUID);
        const exitIdx = getExitIndex(fromNode.node, fromExitUUID);

        updatedNodes = mutate(updatedNodes, {
            [fromNodeUUID]: {
                node: {
                    exits: {
                        [exitIdx]: merge({ destination_node_uuid: node.node.uuid })
                    }
                }
            }
        });
    }

    return updatedNodes;
};

/**
 * Inserts the given action according to the node editor settings determining
 * if new nodes need to be created or connections made.
 * @param nodes the original node map
 * @param action the new or update action
 */
export const replaceWithAction = (
    nodes: RenderNodeMap,
    nodeEditor: NodeEditorSettings,
    action: AnyAction
): RenderNodeMap => {
    if (nodeEditor.originalNode == null) {
        throw new Error('Need originalNode in settings to update an action');
    }

    const { originalNode, originalAction } = nodeEditor;

    let updatedNodes = nodes;
    const creatingNewNode = originalNode !== null && originalNode.ghost;

    if (creatingNewNode) {
        const newNode: RenderNode = {
            node: {
                uuid: createUUID(),
                actions: [action],
                exits: [{ uuid: createUUID(), destination_node_uuid: null, name: null }]
            },
            ui: { position: originalNode.ui.position },
            inboundConnections: originalNode.inboundConnections
        };
        updatedNodes = mergeNode(updatedNodes, newNode);
    } else if (nodeEditor.userAddingAction) {
        updatedNodes = addAction(updatedNodes, originalNode.node.uuid, action);
    } else if (originalNode.node.hasOwnProperty('router')) {
        updatedNodes = replaceRouterWithAction(updatedNodes, originalNode.node.uuid, action);
    } else {
        updatedNodes = updateAction(updatedNodes, originalNode.node.uuid, action, originalAction);
    }

    return updatedNodes;
};

export const replaceWithRouter = (
    nodes: RenderNodeMap,
    nodeEditor: NodeEditorSettings,
    newRouter: RenderNode
): RenderNodeMap => {
    // TODO: update result names

    const { originalNode, originalAction } = nodeEditor;

    let updated = nodes;

    if (originalNode) {
        const previousPosition = originalNode.ui.position;
        newRouter.ui.position = previousPosition;
    }

    if (originalNode.ghost) {
        newRouter.inboundConnections = originalNode.inboundConnections;
        const { left, top } = originalNode.ui.position;
        newRouter.ui.position = { left, top };
        newRouter.node = uniquifyNode(newRouter.node);
    }

    if (originalNode && originalAction) {
        const actionToSplice = originalNode.node.actions.find(
            (action: Action) => action.uuid === originalAction.uuid
        );

        if (actionToSplice) {
            // if we are splicing using the original top
            newRouter.ui.position.top = originalNode.ui.position.top;
            return spliceInRouter(nodes, newRouter, {
                nodeUUID: originalNode.node.uuid,
                actionUUID: actionToSplice.uuid
            });
        }

        // don't recognize that action, let's add a new router node
        const router = newRouter.node.router as SwitchRouter;
        const exitToUpdate = newRouter.node.exits.find(
            (exit: Exit) => exit.uuid === router.default_exit_uuid
        );

        exitToUpdate.destination_node_uuid = originalNode.node.exits[0].destination_node_uuid;

        newRouter.inboundConnections = {
            [originalNode.node.exits[0].uuid]: originalNode.node.uuid
        };
        newRouter.node = uniquifyNode(newRouter.node);
        newRouter.ui.position.top = originalNode.ui.position.bottom;
        updated = mergeNode(updated, newRouter);
    } else {
        updated = mergeNode(updated, newRouter);
    }

    return updated;
};

export const spliceInRouter = (
    nodes: RenderNodeMap,
    newRouterNode: RenderNode,
    previousAction: { nodeUUID: string; actionUUID: string }
): RenderNodeMap => {
    const previousNode = nodes[previousAction.nodeUUID];

    // remove our old node, we'll make new ones
    let updatedNodes = nodes;
    updatedNodes = removeNode(updatedNodes, previousNode.node.uuid, false);

    newRouterNode.node = uniquifyNode(newRouterNode.node);

    const actionIdx = getActionIndex(previousNode.node, previousAction.actionUUID);

    // we need to splice a wait node where our previousAction was
    const topActions: Action[] =
        actionIdx > 0 ? [...previousNode.node.actions.slice(0, actionIdx)] : [];
    const bottomActions: Action[] = previousNode.node.actions.slice(
        actionIdx + 1,
        previousNode.node.actions.length
    );

    // tslint:disable-next-line:prefer-const
    let { left, top } = previousNode.ui.position;

    let topNode: RenderNode;
    let bottomNode: RenderNode;

    // add our top node if we have one
    if (topActions.length > 0) {
        topNode = {
            node: {
                uuid: createUUID(),
                actions: topActions,
                exits: [
                    {
                        uuid: createUUID(),
                        destination_node_uuid: null
                    }
                ]
            },
            ui: { position: { left, top } },
            inboundConnections: { ...previousNode.inboundConnections }
        };

        updatedNodes = mergeNode(updatedNodes, topNode);
        top += NODE_SPACING;

        // update our routerNode for the presence of a top node
        newRouterNode.inboundConnections = { [topNode.node.exits[0].uuid]: topNode.node.uuid };
        newRouterNode.ui.position.top += NODE_SPACING;
    } else {
        newRouterNode.inboundConnections = { ...previousNode.inboundConnections };
    }

    // now add our routerNode
    updatedNodes = mergeNode(updatedNodes, newRouterNode);

    // add our bottom
    if (bottomActions.length > 0) {
        bottomNode = {
            node: {
                uuid: createUUID(),
                actions: bottomActions,
                exits: [
                    {
                        uuid: createUUID(),
                        destination_node_uuid: previousNode.node.exits[0].destination_node_uuid
                    }
                ]
            },
            ui: {
                position: { left, top }
            },
            inboundConnections: { [newRouterNode.node.exits[0].uuid]: newRouterNode.node.uuid }
        };
        updatedNodes = mergeNode(updatedNodes, bottomNode);
    } else {
        // if we don't have a bottom, route our routerNode to the previous destination
        updatedNodes = updateConnection(
            updatedNodes,
            newRouterNode.node.uuid,
            newRouterNode.node.exits[0].uuid,
            previousNode.node.exits[0].destination_node_uuid
        );
    }

    return updatedNodes;
};

/**
 * Adds a given action to the provided node
 * @param nodes
 * @param nodeUUID
 * @param action
 */
export const addAction = (
    nodes: RenderNodeMap,
    nodeUUID: string,
    action: AnyAction
): RenderNodeMap => {
    // check that our node exists
    getNode(nodes, nodeUUID);
    return mutate(nodes, { [nodeUUID]: { node: { actions: push([action]) } } });
};

/**
 * Updates the given action in place by it's uuid
 * @param nodes
 * @param nodeUUID
 * @param action
 */
export const updateAction = (
    nodes: RenderNodeMap,
    nodeUUID: string,
    newAction: AnyAction,
    originalAction?: AnyAction
) => {
    const originalNode = getNode(nodes, nodeUUID);
    // If we have existing actions, find our action and update it
    const actionIdx = originalAction ? getActionIndex(originalNode.node, originalAction.uuid) : 0;
    return mutate(nodes, {
        [nodeUUID]: {
            node: {
                actions: { [actionIdx]: set(newAction) }
            }
        }
    });
};

export const replaceRouterWithAction = (
    nodes: RenderNodeMap,
    nodeUUID: string,
    action: AnyAction
): RenderNodeMap => {
    const { [nodeUUID]: previousNode } = nodes;

    const otherExit = getDefaultExit(previousNode.node);
    const destination = otherExit ? otherExit.destination_node_uuid : null;

    const newNode: RenderNode = {
        node: {
            uuid: createUUID(),
            actions: [action],
            exits: [{ uuid: createUUID(), destination_node_uuid: destination, name: null }]
        },
        ui: { position: previousNode.ui.position },
        inboundConnections: previousNode.inboundConnections
    };

    let updatedNodes = mergeNode(nodes, newNode);

    // remove our prevous node
    updatedNodes = removeNode(updatedNodes, previousNode.node.uuid, false);

    return updatedNodes;
};

/** Removes a specific action from a node */
export const removeAction = (nodes: RenderNodeMap, nodeUUID: string, actionUUID: string) => {
    const renderNode = getNode(nodes, nodeUUID);
    const actionIdx = getActionIndex(renderNode.node, actionUUID);
    return mutate(nodes, {
        [nodeUUID]: { node: { actions: splice([[actionIdx, 1]]) } }
    });
};

/**
 * Moves a single action up in the list for the given node
 * @param nodes
 * @param nodeUUID
 * @param action
 */
export const moveActionUp = (nodes: RenderNodeMap, nodeUUID: string, actionUUID: string) => {
    const renderNode = getNode(nodes, nodeUUID);

    const actions = renderNode.node.actions;
    const actionIdx = getActionIndex(renderNode.node, actionUUID);

    if (actionIdx === 0) {
        throw new Error('Cannot move an action at the top upwards');
    }

    const action = actions[actionIdx];
    const actionAbove = actions[actionIdx - 1];

    return mutate(nodes, {
        [nodeUUID]: {
            node: { actions: splice([[actionIdx - 1, 2, action, actionAbove]]) }
        }
    });
};

/**
 * Removes a given node from our node map. Updates destinations for any exits that point to us
 * and removes any inboundConnections that reference our exits. Also will reroute connections
 * that route through us.
 * @param nodes
 * @param nodeToRemove
 */
export const removeNode = (
    nodes: RenderNodeMap,
    nodeUUID: string,
    remap: boolean = true
): RenderNodeMap => {
    const nodeToRemove = getNode(nodes, nodeUUID);
    let updatedNodes = nodes;

    // remove us from any inbound connections
    for (const exit of nodeToRemove.node.exits) {
        if (exit.destination_node_uuid) {
            updatedNodes = mutate(updatedNodes, {
                [exit.destination_node_uuid]: {
                    inboundConnections: unset([exit.uuid])
                }
            });
        }
    }

    // if we have a single destination, reroute those pointing to us
    let destination = null;
    if (remap && nodeToRemove.node.exits.length === 1) {
        ({ destination_node_uuid: destination } = nodeToRemove.node.exits[0]);
    }

    // clear any destinations that point to us
    for (const fromExitUUID of Object.keys(nodeToRemove.inboundConnections)) {
        const fromNodeUUID = nodeToRemove.inboundConnections[fromExitUUID];
        const fromNode = getNode(nodes, fromNodeUUID);

        // TODO: this can be optimized to only go through any node's exits once
        const exitIdx = getExitIndex(fromNode.node, fromExitUUID);
        updatedNodes = mutate(updatedNodes, {
            [fromNodeUUID]: {
                node: {
                    exits: {
                        [exitIdx]: { destination_node_uuid: set(destination) }
                    }
                }
            }
        });

        // if we are setting a new destination, update the inboundConnections
        if (destination) {
            // make sure our destination exists
            getNode(nodes, destination);
            updatedNodes = mutate(updatedNodes, {
                [destination]: {
                    inboundConnections: merge({ [fromExitUUID]: fromNodeUUID })
                }
            });
        }
    }

    // remove the actual node
    return mutate(updatedNodes, unset([nodeUUID]));
};

/**
 * Update the position for a given node
 * @param nodes
 * @param nodeUUID
 * @param x
 * @param y
 */
export const updatePosition = (
    nodes: RenderNodeMap,
    nodeUUID: string,
    left: number,
    top: number
): RenderNodeMap => {
    const lastPos = getNode(nodes, nodeUUID).ui.position;
    const width = lastPos.right - lastPos.left;
    const height = lastPos.bottom - lastPos.top;

    // make sure we are on the grid
    const adjusted = snapToGrid(left, top);

    return mutate(nodes, {
        [nodeUUID]: {
            ui: {
                position: set({
                    left: adjusted.left,
                    top: adjusted.top,
                    right: adjusted.left + width,
                    bottom: adjusted.top + height
                })
            }
        }
    });
};

/**
 * Update the dimensions for a specific node
 * @param nodes
 * @param nodeUUID
 * @param dimensions
 */
export const updateDimensions = (
    nodes: RenderNodeMap,
    nodeUUID: string,
    dimensions: Dimensions
): RenderNodeMap => {
    const node = getNode(nodes, nodeUUID);
    return mutate(nodes, {
        [nodeUUID]: {
            ui: {
                position: merge({
                    bottom: node.ui.position.top + dimensions.height,
                    right: node.ui.position.left + dimensions.width
                })
            }
        }
    });
};

export const updateStickyNote = (
    definition: FlowDefinition,
    stickyUUID: string,
    sticky: StickyNote
): FlowDefinition => {
    if (!definition._ui.stickies) {
        definition._ui.stickies = {};
    }
    if (sticky) {
        return mutate(definition, { _ui: { stickies: merge({ [stickyUUID]: sticky }) } });
    } else {
        return mutate(definition, { _ui: { stickies: unset([stickyUUID]) } });
    }
};

export const mergeNodeEditorSettings = (
    current: NodeEditorSettings,
    newSettings: NodeEditorSettings
) => {
    if (!newSettings) {
        return current;
    }

    if (!current) {
        return newSettings;
    }

    return mutate(current, { $merge: newSettings });
};

/**
 * Prunes the definition for editing, removing node references
 * @param definition our full definition
 */
export const pruneDefinition = (definition: FlowDefinition): FlowDefinition =>
    mutate(definition, { nodes: [], _ui: { $merge: { nodes: [] } } });

/**
 * Update the localization in the definition with the provided changes for a language
 * @param definition
 * @param language
 * @param changes
 */
export const updateLocalization = (
    definition: FlowDefinition,
    language: string,
    changes: LocalizationUpdates
) => {
    let newDef = definition;

    // Add language to localization map if not present
    if (!newDef.localization[language]) {
        newDef = mutate(newDef, {
            localization: {
                [language]: set({})
            }
        });
    }

    // Apply changes
    changes.forEach(({ translations, uuid }) => {
        if (translations) {
            // adding localization
            newDef = mutate(newDef, {
                localization: { [language]: { [uuid]: set(translations) } }
            });
        } else {
            // removing localization
            newDef = mutate(newDef, {
                localization: { [language]: unset([uuid]) }
            });
        }
    });

    return newDef;
};
