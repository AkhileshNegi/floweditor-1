import { FlowState } from '~/components/context/flow/FlowContext';
import { UpdateLocalizations } from '~/components/nodeeditor/NodeEditor';
import { Type } from '~/config/typeConfigs';
import { AnyAction } from '~/flowTypes';
import { Asset } from '~/services/AssetService';
import { RenderNode } from '~/store/flowContext';
import { NodeEditorSettings } from '~/store/nodeEditor';

export interface ActionFormProps {
    // action details
    nodeSettings: NodeEditorSettings;
    typeConfig: Type;

    // update handlers
    updateAction(action: AnyAction): void;

    // modal notifiers
    onTypeChange(config: Type): void;
    onClose(canceled: boolean): void;
}

export interface RouterFormProps {
    nodeSettings: NodeEditorSettings;
    typeConfig: Type;

    // update handlers
    updateRouter(renderNode: RenderNode): void;

    // modal notifiers
    onTypeChange(config: Type): void;
    onClose(canceled: boolean): void;

    flowState?: FlowState;
}

export interface LocalizationFormProps {
    language: Asset;
    nodeSettings: NodeEditorSettings;
    updateLocalizations(languageCode: string, localizations: any[]): UpdateLocalizations;
    onClose(canceled: boolean): void;
}
