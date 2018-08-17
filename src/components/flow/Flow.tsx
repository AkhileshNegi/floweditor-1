import { react as bindCallbacks } from 'auto-bind';
import * as React from 'react';
import { EditorConsumer, EditorState } from '~/components/context/editor/EditorContext';
import { ConnectionEvent, FlowConsumer, FlowState } from '~/components/context/flow/FlowContext';
import * as styles from '~/components/flow/Flow.scss';
import ConnectedNode from '~/components/flow/node/Node';
import { getDraggedFrom } from '~/components/helpers';
import ConnectedNodeEditor from '~/components/nodeeditor/NodeEditor';
import Simulator from '~/components/simulator/Simulator';
import Sticky from '~/components/sticky/Sticky';
import { ConfigProviderContext } from '~/config';
import { fakePropType } from '~/config/ConfigProvider';
import { getActivity } from '~/external';
import { FlowDefinition } from '~/flowTypes';
import ActivityManager from '~/services/ActivityManager';
import Plumber from '~/services/Plumber';
import { DragSelection } from '~/store/editor';
import { RenderNodeMap } from '~/store/flowContext';
import { getCollisions } from '~/store/helpers';
import { contextTypes } from '~/testUtils';
import {
    createUUID,
    isRealValue,
    NODE_PADDING,
    renderIf,
    snapToGrid,
    timeEnd,
    timeStart
} from '~/utils';
import Debug from '~/utils/debug';

export interface FlowProps {
    definition: FlowDefinition;
    flowState?: FlowState;
    editorState?: EditorState;
}

export interface Translations {
    [uuid: string]: any;
}

export const REPAINT_TIMEOUT = 500;
export const GHOST_POSITION_INITIAL = { left: -1000, top: -1000 };

export const nodeSpecId = 'node';
export const nodesContainerSpecId = 'node-container';
export const ghostNodeSpecId = 'ghost-node';
export const dragSelectSpecId = 'drag-select';

export const isDraggingBack = (event: ConnectionEvent) => {
    return event.suspendedElementId === event.targetId && event.source !== null;
};

export const getDragStyle = (drag: DragSelection) => {
    const left = Math.min(drag.startX, drag.currentX);
    const top = Math.min(drag.startY, drag.currentY);
    const width = Math.max(drag.startX, drag.currentX) - left;
    const height = Math.max(drag.startY, drag.currentY) - top;
    return {
        left,
        top,
        width,
        height
    };
};

export class Flow extends React.Component<FlowProps> {
    private Activity: ActivityManager;
    private Plumber: Plumber;
    private containerOffset = { left: 0, top: 0 };
    private ele: HTMLDivElement;
    private nodeContainerUUID: string;

    // Refs
    private ghost: any;

    public static contextTypes = {
        endpoints: fakePropType,
        debug: fakePropType
    };

    constructor(props: FlowProps, context: ConfigProviderContext) {
        super(props, context);

        this.nodeContainerUUID = createUUID();

        this.Activity = new ActivityManager(props.flowState.definition.uuid, getActivity);

        this.Plumber = new Plumber();

        /* istanbul ignore next */
        if (context.debug) {
            window.fe = new Debug(props.editorState, this.props.editorState.debug);
        }

        bindCallbacks(this, {
            include: [/Ref$/, /^on/, /^is/]
        });

        timeStart('RenderAndPlumb');
    }

    private onRef(ref: HTMLDivElement): HTMLDivElement {
        return (this.ele = ref);
    }

    private ghostRef(ref: any): any {
        return (this.ghost = ref);
    }

    public componentDidMount(): void {
        this.Plumber.bind('connection', (event: ConnectionEvent) =>
            this.props.flowState.mutator.updateConnection(event.sourceId, event.targetId)
        );

        this.Plumber.bind('beforeDrag', (event: ConnectionEvent) =>
            this.beforeConnectionDrag(event)
        );

        this.Plumber.bind('connectionDrag', (event: ConnectionEvent) => {
            this.props.flowState.mutator.updateConnectionDrag(event);
        });

        this.Plumber.bind('connectionDragStop', (event: ConnectionEvent) =>
            this.onConnectorDrop(event)
        );

        this.Plumber.bind(
            'beforeStartDetach',
            (event: ConnectionEvent) => !this.props.editorState.translating
        );

        this.Plumber.bind('beforeDetach', (event: ConnectionEvent) => true);

        this.Plumber.bind('beforeDrop', (event: ConnectionEvent) =>
            this.onBeforeConnectorDrop(event)
        );

        // If we don't have any nodes, create our first one
        this.props.flowState.mutator.ensureStartNode();

        let offset = { left: 0, top: 0 };

        /* istanbul ignore next */
        if (this.ele) {
            offset = this.ele.getBoundingClientRect();
        }
        this.containerOffset = { left: offset.left, top: offset.top + window.scrollY };

        timeEnd('RenderAndPlumb');

        // deals with safari load rendering throwing
        // off the jsplumb offsets
        window.setTimeout(() => this.Plumber.repaint(), REPAINT_TIMEOUT);
    }

    public componentWillUnmount(): void {
        this.Plumber.reset();
    }

    /**
     * Called right before a connector is dropped onto a new node
     */
    private onBeforeConnectorDrop(event: ConnectionEvent): boolean {
        this.props.flowState.mutator.closeNodeEditor(true);

        if (event.sourceId.split(':')[0] === event.targetId) {
            console.error(event.targetId + ' cannot point to itself');
            return false;
        }

        return true;
    }

    // private onShowDefinition(definition: FlowDefinition): void {
    //     TODO: make this work, it's cool!
    //     this.Plumber.reset();
    //     this.setState({ viewDefinition: definition }, () => { this.Plumber.repaint() });
    // }

    /**
     * Called the moment a connector is done dragging, whether it is dropped on an
     * existing node or on to empty space.
     */
    private onConnectorDrop(event: ConnectionEvent): boolean {
        const { ghostNode } = this.props.flowState;
        // Don't show the node editor if we a dragging back to where we were
        if (isRealValue(ghostNode) && !isDraggingBack(event)) {
            // Wire up the drag from to our ghost node
            this.Plumber.recalculate(ghostNode.node.uuid);

            const dragPoint = getDraggedFrom(ghostNode);
            this.Plumber.connect(
                dragPoint.nodeUUID + ':' + dragPoint.exitUUID,
                ghostNode.node.uuid
            );

            // Save our position for later
            const { left, top } = snapToGrid(this.ghost.ele.offsetLeft, this.ghost.ele.offsetTop);

            ghostNode.ui.position = { left, top };
            let originalAction = null;
            if (ghostNode.node.actions && ghostNode.node.actions.length === 1) {
                originalAction = ghostNode.node.actions[0];
            }

            // Bring up the node editor
            this.props.flowState.mutator.openNodeEditor({
                originalNode: ghostNode,
                originalAction
            });
        }

        // To-do: mock this out
        /* istanbul ignore next */
        $(document).off('mousemove');

        return true;
    }

    private beforeConnectionDrag(event: ConnectionEvent): boolean {
        return !this.props.editorState.translating;
    }

    private getNodes(nodes: RenderNodeMap): JSX.Element[] {
        return Object.keys(nodes).map(uuid => {
            const renderNode = nodes[uuid];
            return (
                <ConnectedNode
                    key={uuid}
                    data-spec={nodeSpecId}
                    renderNode={renderNode}
                    Activity={this.Activity}
                    plumberRepaintForDuration={this.Plumber.repaintForDuration}
                    plumberDraggable={this.Plumber.draggable}
                    plumberMakeTarget={this.Plumber.makeTarget}
                    plumberRemove={this.Plumber.remove}
                    plumberRecalculate={this.Plumber.recalculate}
                    plumberMakeSource={this.Plumber.makeSource}
                    plumberConnectExit={this.Plumber.connectExit}
                    plumberSetDragSelection={this.Plumber.setDragSelection}
                    plumberClearDragSelection={this.Plumber.clearDragSelection}
                    plumberRemoveFromDragSelection={this.Plumber.removeFromDragSelection}
                />
            );
        });
    }

    private getStickies(): JSX.Element[] {
        const stickyMap = this.props.flowState.definition._ui.stickies || {};
        return Object.keys(stickyMap).map(uuid => {
            return (
                <Sticky
                    key={uuid}
                    uuid={uuid}
                    sticky={stickyMap[uuid]}
                    plumberClearDragSelection={this.Plumber.clearDragSelection}
                    plumberDraggable={this.Plumber.draggable}
                    plumberRemove={this.Plumber.remove}
                />
            );
        });
    }

    private getDragNode(): JSX.Element {
        return isRealValue(this.props.flowState.ghostNode) ? (
            <ConnectedNode
                ref={this.ghostRef}
                key={this.props.flowState.ghostNode.node.uuid}
                data-spec={ghostNodeSpecId}
                ghost={true}
                renderNode={this.props.flowState.ghostNode}
                Activity={this.Activity}
                plumberRepaintForDuration={this.Plumber.repaintForDuration}
                plumberDraggable={this.Plumber.draggable}
                plumberMakeTarget={this.Plumber.makeTarget}
                plumberRemove={this.Plumber.remove}
                plumberRecalculate={this.Plumber.recalculate}
                plumberMakeSource={this.Plumber.makeSource}
                plumberConnectExit={this.Plumber.connectExit}
                plumberClearDragSelection={this.Plumber.clearDragSelection}
                plumberSetDragSelection={this.Plumber.setDragSelection}
                plumberRemoveFromDragSelection={this.Plumber.removeFromDragSelection}
            />
        ) : null;
    }

    private getSimulator(): JSX.Element {
        return renderIf(this.context.endpoints && this.context.endpoints.simulateStart)(
            <Simulator Activity={this.Activity} plumberDraggable={this.Plumber.draggable} />
        );
    }

    private getNodeEditor(): JSX.Element {
        return renderIf(this.props.flowState.nodeEditorOpen)(
            <ConnectedNodeEditor
                plumberConnectExit={this.Plumber.connectExit}
                plumberRepaintForDuration={this.Plumber.repaintForDuration}
            />
        );
    }

    private isClickOnCanvas(event: React.MouseEvent<HTMLDivElement>): boolean {
        // TODO: not sure the TS-safe way to access id here
        return (event.target as any).id === this.nodeContainerUUID;
    }

    private onDoubleClick(event: React.MouseEvent<HTMLDivElement>): void {
        if (this.isClickOnCanvas(event)) {
            const { left, top } = snapToGrid(
                event.clientX - this.containerOffset.left - 100 + NODE_PADDING,
                event.clientY - this.containerOffset.top - NODE_PADDING * 2
            );

            this.props.flowState.mutator.updateSticky(createUUID(), {
                position: { left, top },
                title: 'New Note',
                body: '...'
            });
        }
    }

    public onMouseDown(event: React.MouseEvent<HTMLDivElement>): void {
        if (this.isClickOnCanvas(event)) {
            this.props.editorState.mutator.mergeEditorState({
                dragSelection: {
                    startX: event.pageX - this.containerOffset.left,
                    startY: event.pageY - this.containerOffset.top,
                    currentX: event.pageX - this.containerOffset.left,
                    currentY: event.pageY - this.containerOffset.top,
                    selected: null
                }
            });
        }
    }

    public onMouseMove(event: React.MouseEvent<HTMLDivElement>): void {
        if (this.props.editorState.dragSelection && this.props.editorState.dragSelection.startX) {
            const drag = this.props.editorState.dragSelection;
            const left = Math.min(drag.startX, drag.currentX);
            const top = Math.min(drag.startY, drag.currentY);
            const right = Math.max(drag.startX, drag.currentX);
            const bottom = Math.max(drag.startY, drag.currentY);

            this.props.editorState.mutator.mergeEditorState({
                dragSelection: {
                    startX: drag.startX,
                    startY: drag.startY,
                    currentX: event.pageX - this.containerOffset.left,
                    currentY: event.pageY - this.containerOffset.top,
                    selected: getCollisions(this.props.flowState.nodes, {
                        left,
                        top,
                        right,
                        bottom
                    })
                }
            });
        }
    }

    public onMouseUp(event: React.MouseEvent<HTMLDivElement>): void {
        if (this.props.editorState.dragSelection) {
            this.props.editorState.mutator.mergeEditorState({
                dragSelection: {
                    startX: null,
                    startY: null,
                    currentX: null,
                    currentY: null,
                    selected: this.props.editorState.dragSelection.selected
                }
            });

            if (this.props.editorState.dragSelection.selected) {
                this.Plumber.setDragSelection(this.props.editorState.dragSelection.selected);
            }
        }
    }

    public getDragSelectionBox(): JSX.Element {
        if (this.props.editorState.dragSelection && this.props.editorState.dragSelection.startX) {
            return (
                <div
                    data-spec={dragSelectSpecId}
                    className={styles.dragSelection}
                    style={{ ...getDragStyle(this.props.editorState.dragSelection) }}
                />
            );
        }
        return null;
    }

    public render(): JSX.Element {
        return (
            <>
                {this.getSimulator()}
                {this.getDragNode()}
                {this.getNodeEditor()}
                <div
                    ref={this.onRef}
                    id={this.nodeContainerUUID}
                    className={styles.nodeList}
                    data-spec={nodesContainerSpecId}
                    onMouseDown={this.onMouseDown}
                    onMouseMove={this.onMouseMove}
                    onMouseUp={this.onMouseUp}
                    onDoubleClick={this.onDoubleClick}
                >
                    {this.getStickies()}
                    {this.getDragSelectionBox()}
                    <FlowConsumer>{flowState => this.getNodes(flowState.nodes)}</FlowConsumer>
                </div>
            </>
        );
    }
}
export default React.forwardRef((props: any) => (
    <EditorConsumer>
        {editorState => (
            <FlowConsumer>
                {flowState => <Flow {...props} flowState={flowState} editorState={editorState} />}
            </FlowConsumer>
        )}
    </EditorConsumer>
));
