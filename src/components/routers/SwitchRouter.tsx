import * as React from 'react';
import * as FlipMove from 'react-flip-move';
import * as update from 'immutability-helper';
import { v4 as generateUUID } from 'uuid';
// import { DragDropContext } from 'react-dnd';
import { Node, SwitchRouter, Exit, Case, AnyAction } from '../../flowTypes';
import { Type } from '../../providers/typeConfigs';
import { FormProps } from '../NodeEditor';
import ComponentMap from '../../services/ComponentMap';
import { Language } from '../LanguageSelector';
import { LocalizedObject } from '../../services/Localization';
import CaseElement from '../form/CaseElement';
import TextInputElement, { HTMLTextElement } from '../form/TextInputElement';
import { getOperatorConfigPT } from '../../providers/propTypes';
import { ConfigProviderContext } from '../../providers/ConfigProvider';

// const HTML5Backend = require('react-dnd-html5-backend');
const styles = require('./SwitchRouter.scss');

export interface CaseProps {
    kase: Case;
    exitName: string;
    onChanged: Function;
    moveCase: Function;
}

export interface CombinedExits {
    cases: Case[];
    exits: Exit[];
    defaultExit: string;
}

/**
 * Given a set of cases and previous exits, determines correct merging of cases
 * and the union of exits
 * @param newCases
 * @param previousExits
 */
export function resolveExits(newCases: CaseProps[], previous: Node): CombinedExits {
    // create mapping of our old exit uuids to old exit settings
    var previousExitMap: { [uuid: string]: Exit } = {};

    if (previous.exits) {
        for (let exit of previous.exits) {
            previousExitMap[exit.uuid] = exit;
        }
    }

    var exits: Exit[] = [];
    var cases: Case[] = [];

    // map our new cases to an appropriate exit
    for (let newCase of newCases) {
        // see if we have a suitable exit for our case already
        var existingExit: Exit = null;

        // use our previous exit name if it isn't set
        if (!newCase.exitName && newCase.kase.exit_uuid in previousExitMap) {
            newCase.exitName = previousExitMap[newCase.kase.exit_uuid].name;
        }

        // ignore cases with empty names
        if (!newCase.exitName || newCase.exitName.trim().length === 0) {
            continue;
        }

        if (newCase.exitName) {
            // look through our new exits to see if we've already created one
            for (let exit of exits) {
                if (newCase.exitName && exit.name) {
                    if (exit.name.toLowerCase() === newCase.exitName.trim().toLowerCase()) {
                        existingExit = exit;
                        break;
                    }
                }
            }

            // couldn't find a new exit, look through our old ones
            if (!existingExit) {
                // look through our previous cases for a match
                if (previous.exits) {
                    for (let exit of previous.exits) {
                        if (newCase.exitName && exit.name) {
                            if (exit.name.toLowerCase() === newCase.exitName.trim().toLowerCase()) {
                                existingExit = exit;
                                exits.push(existingExit);
                                break;
                            }
                        }
                    }
                }
            }
        }

        // we found a suitable exit, point our case to it
        if (existingExit) {
            newCase.kase.exit_uuid = existingExit.uuid;
        } else {
            // no existing exit, create a new one
            // find our previous destination if we have one
            var destination = null;
            if (newCase.kase.exit_uuid in previousExitMap) {
                destination = previousExitMap[newCase.kase.exit_uuid].destination_node_uuid;
            }

            newCase.kase.exit_uuid = generateUUID();

            exits.push({
                name: newCase.exitName,
                uuid: newCase.kase.exit_uuid,
                destination_node_uuid: destination
            });
        }

        // remove exitName from our case
        cases.push(newCase.kase);
    }

    // add in our default exit
    var defaultUUID = generateUUID();
    if (previous.router && previous.router.type === 'switch') {
        var router = previous.router as SwitchRouter;
        if (router && router.default_exit_uuid) {
            defaultUUID = router.default_exit_uuid;
        }
    }

    var defaultName = 'All Responses';
    if (exits.length > 0) {
        defaultName = 'Other';
    }

    var defaultDestination = null;
    if (defaultUUID in previousExitMap) {
        defaultDestination = previousExitMap[defaultUUID].destination_node_uuid;
    }

    exits.push({
        uuid: defaultUUID,
        name: defaultName,
        destination_node_uuid: defaultDestination
    });

    return { cases: cases, exits: exits, defaultExit: defaultUUID };
}

const composeExitMap = (exits: Exit[]): { [uuid: string]: Exit } =>
    exits.reduce(
        (map, exit) => {
            map[exit.uuid] = exit;
            return map;
        },
        {} as { [uuid: string]: Exit }
    );

export interface SwitchRouterState {
    cases: CaseProps[];
    resultName: string;
    setResultName: boolean;
    operand: string;
}

export interface SwitchRouterFormProps extends FormProps {
    showAdvanced: boolean;
    iso: string;
    node: Node;
    action: AnyAction;
    config: Type;
    updateRouter(node: Node, type: string, previousAction: AnyAction): void;
    onBindWidget(ref: any): void;
    onBindAdvancedWidget(ref: any): void;
    removeWidget(name: string): void;
    localizations?: LocalizedObject[];
    updateLocalizations(language: string, changes: { uuid: string; translations?: any }[]): void;
    ComponentMap: ComponentMap;
    translating: boolean;
    getLocalizedExits(widgets: { [name: string]: any }): { uuid: string; translations: any }[];
    renderExitTranslations(): JSX.Element;
}

export default class SwitchRouterForm extends React.Component<
    SwitchRouterFormProps,
    SwitchRouterState
> {
    public static contextTypes = {
        getOperatorConfig: getOperatorConfigPT
    };

    constructor(props: SwitchRouterFormProps, context: ConfigProviderContext) {
        super(props, context);

        this.onCaseChanged = this.onCaseChanged.bind(this);
        this.moveCase = this.moveCase.bind(this);

        const cases: CaseProps[] = [];
        let resultName = '';
        let operand = '@input';

        const router = this.props.node.router as SwitchRouter;

        if (this.isSwitchRouterNode() && router.cases) {
            ({ operand } = router);

            if (router.result_name) {
                ({ result_name: resultName } = router);
            }

            router.cases.forEach(kase => {
                let exitName: string = null;

                if (kase.exit_uuid) {
                    const exit = this.props.node.exits.find(exit => exit.uuid === kase.exit_uuid);

                    if (exit) {
                        exitName = exit.name;
                    }
                }

                try {
                    const config = this.context.getOperatorConfig(kase.type);

                    cases.push({
                        kase,
                        exitName,
                        onChanged: this.onCaseChanged,
                        moveCase: this.moveCase
                    });
                } catch (error) {
                    /** Ignore missing cases */
                }
            });
        }

        this.state = {
            cases,
            setResultName: false,
            resultName,
            operand
        };

        this.onValid = this.onValid.bind(this);
        this.onExpressionChanged = this.onExpressionChanged.bind(this);
        this.onCaseRemoved = this.onCaseRemoved.bind(this);
        this.onShowNameField = this.onShowNameField.bind(this);
    }

    private isSwitchRouterNode(): boolean {
        return (
            this.props.node.wait &&
            this.props.node.wait.type &&
            (this.props.node.wait.type === 'exp' || this.props.node.wait.type === 'msg')
        );
    }

    public onValid(widgets: { [name: string]: any }): void {
        /** Is the user translating this router? */
        if (this.props.translating) {
            return this.saveLocalization(widgets);
        }

        /**
         * If the user has a localized 'All Responses' case and they're adding another case,
         * bump off the translation for the initial case.
         * */
        if (
            this.props.definition.localization &&
            Object.keys(this.props.definition.localization).length &&
            this.state.cases.length === 1
        ) {
            const { uuid: nodeUUID, exits } = this.props.node;

            const exitMap: { [uuid: string]: Exit } = composeExitMap(exits);

            Object.keys(this.props.definition.localization).forEach(iso => {
                const language = this.props.definition.localization[iso];

                Object.keys(language).forEach(localizationUUID => {
                    if (exitMap[localizationUUID]) {
                        const exitMatch = exitMap[localizationUUID];

                        if (exitMatch.name) {
                            if (exitMatch.name === 'All Responses') {
                                /** Bingo */
                                this.props.updateLocalizations(iso, [{ uuid: localizationUUID }]);
                            }
                        }
                    }
                });
            });
        }

        /** If the user is going from 1 or more cases to 0 and this router has a translation for the 'Other' case, lose it */
        if (
            !this.state.cases.length &&
            this.props.definition.localization &&
            Object.keys(this.props.definition.localization).length
        ) {
            const { uuid: nodeUUID, exits } = this.props.node;

            const exitMap: { [uuid: string]: Exit } = composeExitMap(exits);

            Object.keys(this.props.definition.localization).forEach(iso => {
                const language = this.props.definition.localization[iso];

                Object.keys(language).forEach(localizationUUID => {
                    if (exitMap[localizationUUID]) {
                        const exitMatch = exitMap[localizationUUID];

                        if (exitMatch.name) {
                            if (exitMatch.name === 'Other') {
                                /** Listo */
                                this.props.updateLocalizations(iso, [{ uuid: localizationUUID }]);
                            }
                        }
                    }
                });
            });
        }

        const { cases, exits, defaultExit } = resolveExits(this.state.cases, this.props.node);
        let optionalRouter = {};
        const resultNameEle = widgets['Result Name'] as TextInputElement;

        if (resultNameEle) {
            optionalRouter = {
                result_name: resultNameEle.state.value
            };
        }

        let optionalNode = {};

        if (this.props.config.type === 'wait_for_response') {
            optionalNode = {
                wait: { type: 'msg' }
            };
        } else if (this.props.config.type === 'expression') {
            optionalNode = {
                wait: { type: 'exp' }
            };
        }

        const router: SwitchRouter = {
            type: 'switch',
            default_exit_uuid: defaultExit,
            cases,
            operand: this.state.operand,
            ...optionalRouter
        };

        this.props.updateRouter(
            {
                uuid: this.props.node.uuid,
                router,
                exits,
                ...optionalNode
            },
            this.props.config.type,
            this.props.action
        );
    }

    private onShowNameField(): void {
        this.setState({
            setResultName: true
        });
    }

    private onExpressionChanged(event: React.SyntheticEvent<HTMLTextElement>): void {
        this.setState({
            operand: event.currentTarget.value
        });
    }

    private onCaseRemoved(c: CaseElement): void {
        let idx = this.state.cases.findIndex(
            (props: CaseProps) => props.kase.uuid === c.props.kase.uuid
        );

        if (idx > -1) {
            const cases = update(this.state.cases, { $splice: [[idx, 1]] });
            this.setState({ cases });
        }

        this.props.removeWidget(c.props.name);
    }

    private onCaseChanged(c: CaseElement): void {
        const newCase: CaseProps = {
            kase: {
                uuid: c.props.kase.uuid,
                type: c.state.operator,
                exit_uuid: c.props.kase.exit_uuid,
                arguments: c.state.arguments
            },
            onChanged: c.props.onChanged,
            moveCase: c.props.moveCase,
            exitName: c.state.exitName
        };

        let cases = this.state.cases;
        let found = false;

        for (let idx in cases) {
            const props = cases[idx];
            if (props.kase.uuid === c.props.kase.uuid) {
                cases = update(cases, { [idx]: { $set: newCase } });
                found = true;
                break;
            }
        }

        if (!found) {
            cases = update(cases, { $push: [newCase] });
        }

        this.setState({
            cases
        });
    }

    private saveLocalization(widgets: { [name: string]: any }): void {
        const { iso: language } = this.props.localizations[0].getLanguage();

        const updates = [
            ...this.props.getLocalizedExits(widgets),
            ...this.getLocalizedCases(widgets)
        ] as {
            uuid: string;
            translations: any;
        }[];

        this.props.updateLocalizations(language, updates);
    }

    private getLocalizedCases(widgets: {
        [name: string]: any;
    }): { uuid: string; translations: any }[] {
        const results: { uuid: string; translations: any }[] = [];

        const { cases } = this.props.node.router as SwitchRouter;

        cases.forEach(({ uuid: kaseUUID }) => {
            const input = widgets[kaseUUID] as TextInputElement;

            if (input) {
                const value = input.state.value.trim();

                if (value) {
                    results.push({ uuid: kaseUUID, translations: { arguments: [value] } });
                } else {
                    results.push({ uuid: kaseUUID, translations: null });
                }
            }
        });

        return results;
    }

    private renderAdvanced(): JSX.Element {
        if (this.props.translating) {
            let language: Language;
            const kases: JSX.Element[] = [];

            if (this.props.localizations && this.props.localizations.length) {
                language = this.props.localizations[0].getLanguage();
            }

            if (!language) {
                return null;
            }

            const { cases } = this.props.node.router as SwitchRouter;

            cases.forEach(kase => {
                if (kase.arguments && kase.arguments.length) {
                    const localized = this.props.localizations.find(
                        (localizedObject: LocalizedObject) =>
                            localizedObject.getObject().uuid === kase.uuid
                    );

                    if (localized) {
                        let value: string = null;

                        if ('arguments' in localized.localizedKeys) {
                            const localizedCase: Case = localized.getObject() as Case;

                            if (localizedCase.arguments.length) {
                                [value] = localizedCase.arguments;
                            }
                        }

                        const { verboseName } = this.context.getOperatorConfig(kase.type);

                        const [argument] = kase.arguments;

                        kases.push(
                            <div key={`translate_${kase.uuid}`} className={styles.translating_case}>
                                <div className={styles.translating_operator}>{verboseName}</div>
                                <div className={styles.translating_from}>{argument}</div>
                                <div className={styles.translating_to}>
                                    <TextInputElement
                                        ref={this.props.onBindAdvancedWidget}
                                        name={kase.uuid}
                                        placeholder={`${language.name} Translation`}
                                        showLabel={false}
                                        value={value}
                                        ComponentMap={this.props.ComponentMap}
                                    />
                                </div>
                            </div>
                        );
                    }
                }
            });

            if (!kases.length) {
                return null;
            }

            return (
                <div>
                    <div className={styles.title}>Rules</div>
                    <div className={styles.instructions}>
                        Sometimes languages need special rules to route things properly. If a
                        translation is not provided, the original rule will be used.
                    </div>
                    <div>{kases}</div>
                </div>
            );
        }

        return null;
    }

    private renderForm(): JSX.Element {
        if (this.props.translating) {
            return this.props.renderExitTranslations();
        } else {
            let needsEmpty: boolean = true;
            const cases: JSX.Element[] = [];

            if (this.state.cases) {
                this.state.cases.map((c: CaseProps, index: number) => {
                    /** Is this case empty? */
                    if (
                        (!c.exitName || c.exitName.trim().length === 0) &&
                        (!c.kase.arguments || c.kase.arguments[0].trim().length === 0)
                    ) {
                        needsEmpty = false;
                    }

                    cases.push(
                        <CaseElement
                            key={c.kase.uuid}
                            kase={c.kase}
                            ref={this.props.onBindWidget}
                            name={`case_${index}`}
                            exitName={c.exitName}
                            onRemove={this.onCaseRemoved}
                            onChanged={this.onCaseChanged}
                            moveCase={this.moveCase}
                            ComponentMap={this.props.ComponentMap}
                        />
                    );
                });
            }

            if (needsEmpty) {
                const newCaseUUID = generateUUID();

                cases.push(
                    <CaseElement
                        kase={{
                            uuid: newCaseUUID,
                            type: 'has_any_word',
                            exit_uuid: null
                        }}
                        key={newCaseUUID}
                        ref={this.props.onBindWidget}
                        name={`case_${cases.length}`}
                        exitName={null}
                        onRemove={this.onCaseRemoved}
                        moveCase={this.moveCase}
                        onChanged={this.onCaseChanged}
                        ComponentMap={this.props.ComponentMap}
                    />
                );
            }

            let nameField: JSX.Element = null;

            if (this.state.setResultName || this.state.resultName) {
                nameField = (
                    <TextInputElement
                        ref={this.props.onBindWidget}
                        name="Result Name"
                        showLabel={true}
                        value={this.state.resultName}
                        helpText="By naming the result, you can reference it later using @run.results.whatever_the_name_is"
                        ComponentMap={this.props.ComponentMap}
                    />
                );
            } else {
                nameField = (
                    <span className={styles.save_link} onClick={this.onShowNameField}>
                        Save as..
                    </span>
                );
            }

            let leadIn: JSX.Element = null;

            if (this.props.config.type === 'wait_for_response') {
                leadIn = <div className={styles.instructions}>If the message response..</div>;
            } else if (this.props.config.type === 'expression') {
                leadIn = (
                    <div className={styles.instructions}>
                        <p>If the expression..</p>
                        <TextInputElement
                            ref={this.props.onBindWidget}
                            key={`expression_${this.props.node.uuid}`}
                            name="Expression"
                            showLabel={false}
                            value={this.state.operand}
                            onChange={this.onExpressionChanged}
                            autocomplete
                            required
                            ComponentMap={this.props.ComponentMap}
                        />
                    </div>
                );
            }

            return (
                <div className={styles.switch}>
                    {leadIn}
                    <div className={styles.cases}>{cases}</div>
                    <div className={styles.save_as}>{nameField}</div>
                </div>
            );
        }
    }

    private moveCase(dragIndex: number, hoverIndex: number): void {
        const { cases } = this.state;
        const dragCase = cases[dragIndex];

        this.setState(
            update(this.state, {
                cards: {
                    $splice: [[dragIndex, 1], [hoverIndex, 0, dragCase]]
                }
            })
        );
    }

    public render(): JSX.Element {
        if (this.props.showAdvanced) {
            return this.renderAdvanced();
        }
        return this.renderForm();
    }
}
