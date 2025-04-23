import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import Dialog from './Dialog';
import * as style from '../style';
import { translate } from '../../../common/i18n';
import googleDrive from '../../../common/integrations/GoogleDrive';
import { showSpinnerInButton, removeSpinnerInButton } from '../../../common/utils/tools';
import { retornaValores, parseXMLTemplate } from '../../common/tools';

import {
    isMainBlock,
    save,
    disable,
    deleteBlocksLoadedBy,
    addLoadersFirst,
    cleanUpOnLoad,
    addDomAsBlock,
    backwardCompatibility,
    fixCollapsedBlocks,
    fixArgumentAttribute,
    removeUnavailableMarkets,
    strategyHasValidTradeTypeCategory,
    cleanBeforeExport,
    importFile,
    saveBeforeUnload,
    removeParam,
    updateRenamedFields,
    getPreviousStrat,
} from '../blockly/utils';

import { loadWorkspace } from '../blockly';

class LoadContent extends PureComponent {
    constructor() {
        super();
        this.state = { loadType: 'local' };
    }

    loadTemplateXML(key) {
        const valores = retornaValores(key);
        console.log(key, valores);
        const xml_text = parseXMLTemplate(key, valores);
        // Blockly.Events.setGroup('reset');
        // Blockly.mainWorkspace.clear();
        const xml = Blockly.Xml.textToDom(xml_text);
        loadWorkspace(xml);
        // Blockly.Xml.domToWorkspace(xml, Blockly.mainWorkspace);
        // Blockly.Events.setGroup(false);
    }

    onChange(event) {
        this.setState({ loadType: event.target.value });
    }

    toggle(id) {
        document.getElementById(`collapse${  id}`).classList.toggle('hide');
    }

    submit() {
        const templates = [
  	    'firex',
	    'wolf',
            'rocket',
            'pullover',
            'supremo',
	    'supremo-v5',
	    'supremo2',
	    'half2',
            'extremehook',
            'combinadifere',
            'one50',
            'one70-7',
            'one70-2',
            'one80-1',
            'one80-8',
            'one60-4',
            'one90-1',
            'one90',
	    'boss',
	    'green',
	    'inferior',
	    'low',
	    'ironover',
	    'ironunder',
	    'controlover',
	    'controlunder',
	    'wisepro',
        ];
        const xml = this.state.loadType;
        console.log('key', xml);

        if (templates.indexOf(xml) >= 0) {
            this.loadTemplateXML(xml);
            this.props.closeDialog();
        }
    }


    render() {
        return (
            <form
                id="load-dialog"
                action="javascript:;" // eslint-disable-line no-script-url
                className="dialog-content"
                style={style.content}
                onSubmit={() => this.submit()}
            >
		<div class="row">
		<div class="col">

                <div className="center-text">
		        <span className="header">Automações </span>

                    <input type="button" value="WISEPRO" onClick={e => this.toggle(4)} />
                    <div id="collapse4" class="hide">
                        <span className="integration-option">
                            <input
                                type="radio"
                                id="load-wisepro"
                                name="load-option"
                                value="wisepro"
                                onChange={e => this.onChange(e)}
                            />
                            <label htmlFor="load-wisepro"></label>
                        </span>
                    </div>

                    <input type="button" value="MAXPRO" onClick={e => this.toggle(4)} />
                    <div id="collapse4" class="hide">
                        <span className="integration-option">
                            <input
                                type="radio"
                                id="load-one70-7"
                                name="load-option"
                                value="one70-7"
                                onChange={e => this.onChange(e)}
                            />
                            <label htmlFor="load-one70-7"></label>
                        </span>
                    </div>

	            <input type="button" value="GREEN" onClick={e => this.toggle(7)} />
                    <div id="collapse7" class="hide">
                        <span className="integration-option">
                            <input
                                type="radio"
                                id="load-green"
                                name="load-option"
                                value="green"
                                onChange={e => this.onChange(e)}
                            />
                            <label htmlFor="load-green"> </label>
                        </span>
                    </div>

	            <input type="button" value="PROFIT PRO" onClick={e => this.toggle(7)} />
                    <div id="collapse7" class="hide">
                        <span className="integration-option">
                            <input
                                type="radio"
                                id="load-inferior"
                                name="load-option"
                                value="inferior"
                                onChange={e => this.onChange(e)}
                            />
                            <label htmlFor="load-inferior"> </label>
                        </span>
                    </div>

		    <input type="button" value="BOT LOW" onClick={e => this.toggle(7)} />
                    <div id="collapse7" class="hide">
                        <span className="integration-option">
                            <input
                                type="radio"
                                id="load-low"
                                name="load-option"
                                value="low"
                                onChange={e => this.onChange(e)}
                            />
                            <label htmlFor="load-low"> </label>
                        </span>
                    </div>
		</div>
		</div>

		<div class="col"> 
		<span class="header">Automações over/under </span>

		    <input type="button" value="IRON OVER" onClick={e => this.toggle(7)} />
                    <div id="collapse7" class="hide">
                        <span className="integration-option">
                            <input
                                type="radio"
                                id="load-ironover"
                                name="load-option"
                                value="ironover"
                                onChange={e => this.onChange(e)}
                            />
                            <label htmlFor="load-ironover"> </label>
                        </span>
                    </div>

		    <input type="button" value="IRON UNDER" onClick={e => this.toggle(7)} />
                    <div id="collapse7" class="hide">
                        <span className="integration-option">
                            <input
                                type="radio"
                                id="load-ironunder"
                                name="load-option"
                                value="ironunder"
                                onChange={e => this.onChange(e)}
                            />
                            <label htmlFor="load-ironunder"> </label>
                        </span>
                    </div>

		    <input type="button" value="CONTROL OVER" onClick={e => this.toggle(7)} />
                    <div id="collapse7" class="hide">
                        <span className="integration-option">
                            <input
                                type="radio"
                                id="load-controlover"
                                name="load-option"
                                value="controlover"
                                onChange={e => this.onChange(e)}
                            />
                            <label htmlFor="load-controlover"> </label>
                        </span>
                    </div>

		    <input type="button" value="CONTROL UNDER" onClick={e => this.toggle(7)} />
                    <div id="collapse7" class="hide">
                        <span className="integration-option">
                            <input
                                type="radio"
                                id="load-controlunder"
                                name="load-option"
                                value="controlunder"
                                onChange={e => this.onChange(e)}
                            />
                            <label htmlFor="load-controlunder"> </label>
                        </span>
                    </div>

		</div>
		</div>
		<hr />
                <div className="center-text input-row last">
                    <button
                        id="load-strategy"
                        type="submit"
                        ref={el => {
                            this.submitButton = el;
                        }}
                    >
                        {translate('Carregar')}
                    </button>
                </div>
            </form>
        );
    }

    static props = { closeDialog: PropTypes.func };
}

export default class LoadDialog extends Dialog {
    constructor() {
        const closeDialog = () => {
            this.close();
        };
        super('load-dialog', 'Carregar Automações', <LoadContent closeDialog={closeDialog} />, style.dialogLayout);

        this.registerCloseOnOtherDialog();
    }
}
