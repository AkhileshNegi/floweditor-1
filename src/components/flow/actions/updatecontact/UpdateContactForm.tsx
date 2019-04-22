import { react as bindCallbacks } from 'auto-bind';
import * as React from 'react';
import Dialog, { ButtonSet } from '~/components/dialog/Dialog';
import { hasErrors } from '~/components/flow/actions/helpers';
import {
    initializeForm,
    sortFieldsAndProperties,
    stateToAction,
    UpdateContactFormState
} from '~/components/flow/actions/updatecontact/helpers';
import {
    ActionFormProps,
    CHANNEL_PROPERTY,
    LANGUAGE_PROPERTY,
    NAME_PROPERTY
} from '~/components/flow/props';
import AssetSelector from '~/components/form/assetselector/AssetSelector';
import TextInputElement from '~/components/form/textinput/TextInputElement';
import TypeList from '~/components/nodeeditor/TypeList';
import { fakePropType } from '~/config/ConfigProvider';
import { Types } from '~/config/interfaces';
import { ContactProperties } from '~/flowTypes';
import { Asset, AssetType, updateAssets } from '~/store/flowContext';
import * as mutators from '~/store/mutators';
import { mergeForm, ValidationFailure } from '~/store/nodeEditor';
import { DispatchWithState, GetState } from '~/store/thunks';
import { validate, validateRequired } from '~/store/validators';

import * as styles from './UpdateContact.scss';

export const CONTACT_PROPERTIES: Asset[] = [NAME_PROPERTY, LANGUAGE_PROPERTY, CHANNEL_PROPERTY];

export default class UpdateContactForm extends React.Component<
    ActionFormProps,
    UpdateContactFormState
> {
    public static contextTypes = {
        assetService: fakePropType
    };

    constructor(props: ActionFormProps) {
        super(props);

        this.state = initializeForm(this.props.nodeSettings);

        bindCallbacks(this, {
            include: [/^get/, /^on/, /^handle/]
        });
    }

    private handleUpdate(keys: {
        type?: Types;
        name?: string;
        channel?: Asset;
        language?: Asset;
        field?: Asset;
        fieldValue?: string;
    }): boolean {
        const updates: Partial<UpdateContactFormState> = {};

        if (keys.hasOwnProperty('type')) {
            updates.type = keys.type;
        }

        if (keys.hasOwnProperty('name')) {
            updates.name = { value: keys.name };
        }

        if (keys.hasOwnProperty('channel')) {
            updates.channel = validate('Channel', keys.channel, [validateRequired]);
        }

        if (keys.hasOwnProperty('language')) {
            updates.language = validate('Language', keys.language, [validateRequired]);
        }

        if (keys.hasOwnProperty('field')) {
            updates.field = { value: keys.field };
        }

        if (keys.hasOwnProperty('fieldValue')) {
            updates.fieldValue = { value: keys.fieldValue, validationFailures: [] };
        }

        const updated = mergeForm(this.state, updates);
        this.setState(updated);
        return updated.valid;
    }

    private handlePropertyChange(selected: Asset[]): boolean {
        const selection = selected[0];
        if (selection.type === AssetType.ContactProperty) {
            switch (selection.id) {
                case ContactProperties.Name:
                    return this.handleUpdate({
                        field: selection,
                        type: Types.set_contact_name,
                        name: ''
                    });
                case ContactProperties.Language:
                    return this.handleUpdate({
                        field: selection,
                        type: Types.set_contact_language
                    });
                case ContactProperties.Channel:
                    return this.handleUpdate({ field: selection, type: Types.set_contact_channel });
            }
        }
        return this.handleUpdate({
            type: Types.set_contact_field,
            field: selection,
            fieldValue: ''
        });
    }

    private handleChannelUpdate(selection: Asset[]): boolean {
        return this.handleUpdate({ channel: selection[0] });
    }

    private handleLanguageUpdate(selection: Asset[]): boolean {
        return this.handleUpdate({ language: selection[0] });
    }

    private handleFieldValueUpdate(fieldValue: string): boolean {
        return this.handleUpdate({ fieldValue, name: '' });
    }

    private handleNameUpdate(name: string): boolean {
        return this.handleUpdate({ name, fieldValue: '' });
    }

    private onUpdated(dispatch: DispatchWithState, getState: GetState): void {
        const {
            flowContext: { assetStore }
        } = getState();

        if (this.state.field.value.type === AssetType.Field) {
            dispatch(
                updateAssets(mutators.addAssets('fields', assetStore, [this.state.field.value]))
            );
        }
    }

    public handleFieldAdded(field: Asset): void {
        // update our store with our new group
        this.props.addAsset('fields', field);
        this.handlePropertyChange([field]);
    }

    private handleSave(): void {
        let valid = this.state.valid;

        // check if language required
        if (this.state.type === Types.set_contact_language) {
            valid = this.handleLanguageUpdate([this.state.language.value]) && valid;
        }

        // check if channel required
        if (this.state.type === Types.set_contact_channel) {
            valid = this.handleChannelUpdate([this.state.channel.value]) && valid;
        }

        /*        if (this.state.type === Types.set_contact_field) {
            const fieldValue = mergePersistantFailures(this.state.fieldValue);
            if (fieldValue.validationFailures.length > 0) {
                valid = this.state.
                this.setState({ fieldValue });
            }
        }

        if (this.state.type === Types.set_contact_name) {
            const name = mergePersistantFailures(this.state.name);
            if (name.validationFailures.length > 0) {
                valid = false;
                this.setState({ name });
            }
        }
*/
        if (valid) {
            // do the saving!
            this.props.updateAction(
                stateToAction(this.props.nodeSettings, this.state),
                this.onUpdated
            );
            this.props.onClose(true);
        }
    }

    private getButtons(): ButtonSet {
        return {
            primary: { name: 'Ok', onClick: this.handleSave },
            secondary: { name: 'Cancel', onClick: () => this.props.onClose(true) }
        };
    }

    /**
     * The value widget varies for the action type
     */
    private getValueWidget(): JSX.Element {
        if (this.state.type === Types.set_contact_channel) {
            return (
                <AssetSelector
                    key="select_channel"
                    name="Channel"
                    placeholder="Select the channel to use for this contact"
                    assets={this.props.assetStore.channels}
                    entry={this.state.channel}
                    searchable={true}
                    valueClearable={true}
                    onChange={this.handleChannelUpdate}
                />
            );
        }

        if (this.state.type === Types.set_contact_language) {
            return (
                <AssetSelector
                    key="select_language"
                    name="Language"
                    placeholder="Select the language to use for this contact"
                    assets={this.props.assetStore.languages}
                    entry={this.state.language}
                    searchable={true}
                    valueClearable={true}
                    onChange={this.handleLanguageUpdate}
                />
            );
        } else if (this.state.type === Types.set_contact_name) {
            return (
                <TextInputElement
                    name="Name"
                    placeholder="Enter a new name for the contact"
                    onFieldFailures={(persistantFailures: ValidationFailure[]) => {
                        const name = { ...this.state.name, persistantFailures };
                        this.setState({ name, valid: this.state.valid && !hasErrors(name) });
                    }}
                    onChange={this.handleNameUpdate}
                    entry={this.state.name}
                    autocomplete={true}
                    focus={true}
                />
            );
        } else {
            return (
                <TextInputElement
                    name="Field Value"
                    placeholder={`Enter a new value for ${this.state.field.value.name}`}
                    onFieldFailures={(persistantFailures: ValidationFailure[]) => {
                        const fieldValue = { ...this.state.fieldValue, persistantFailures };
                        this.setState({
                            fieldValue,
                            valid: this.state.valid && !hasErrors(fieldValue)
                        });
                    }}
                    onChange={this.handleFieldValueUpdate}
                    entry={this.state.fieldValue}
                    autocomplete={true}
                    focus={true}
                />
            );
        }
    }

    public handleCreateAssetFromInput(input: string): any {
        return { label: input, value_type: 'text' };
    }

    public render(): JSX.Element {
        const typeConfig = this.props.typeConfig;

        return (
            <Dialog
                title={typeConfig.name}
                headerClass={typeConfig.type}
                buttons={this.getButtons()}
            >
                <TypeList
                    __className=""
                    initialType={typeConfig}
                    onChange={this.props.onTypeChange}
                />

                <p>Select what to update</p>
                <AssetSelector
                    name="Contact Field"
                    assets={this.props.assetStore.fields}
                    additionalOptions={CONTACT_PROPERTIES}
                    entry={this.state.field}
                    searchable={true}
                    sortFunction={sortFieldsAndProperties}
                    onChange={this.handlePropertyChange}
                    // Fields can be created on the fly
                    createPrefix="Create Contact Field: "
                    createAssetFromInput={this.handleCreateAssetFromInput}
                    onAssetCreated={this.handleFieldAdded}
                />

                <div className={styles.value}>{this.getValueWidget()}</div>
            </Dialog>
        );
    }
}
