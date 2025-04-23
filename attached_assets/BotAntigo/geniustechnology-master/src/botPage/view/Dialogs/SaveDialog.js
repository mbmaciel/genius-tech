import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import Dialog from './Dialog';
import { cleanBeforeExport } from '../blockly/utils';
import * as style from '../style';
import { translate } from '../../../common/i18n';
import googleDrive from '../../../common/integrations/GoogleDrive';
import { observer as globalObserver } from '../../../common/utils/observer';
import { showSpinnerInButton, removeSpinnerInButton } from '../../../common/utils/tools';
import { saveAs } from 'file-saver';

class SaveContent extends PureComponent {
    constructor() {
        super();
        this.state = {
            error   : null,
            saveType: 'local',
        };
    }

    submit() {
        const filename = $(this.filename).val() || 'binary-bot';
        const collection = $(this.isCollection).prop('checked');

        if (this.state.saveType === 'google-drive') {
            const initialButtonText = $(this.submitButton).text();
            showSpinnerInButton($(this.submitButton));

            const xml = Blockly.Xml.workspaceToDom(Blockly.mainWorkspace);
            cleanBeforeExport(xml);

            xml.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
            xml.setAttribute('collection', collection);

            googleDrive
                .saveFile({
                    name    : filename,
                    content : Blockly.Xml.domToPrettyText(xml),
                    mimeType: 'application/xml',
                })
                .then(() => {
                    globalObserver.emit('ui.log.success', translate('Successfully uploaded to Google Drive'));
                    this.props.closeDialog();
                    removeSpinnerInButton($(this.submitButton), initialButtonText);
                })
                .catch(() => {
                    removeSpinnerInButton($(this.submitButton), initialButtonText);
                });
        } else {
            this.props.onSave({
                filename,
                collection,
            });
        }
    }

    onChange(event) {
        this.setState({ saveType: event.target.value });
    }

    render() {
        return (
            <form
                id="save-dialog"
                action="javascript:;" // eslint-disable-line no-script-url
                onSubmit={() => this.submit()}
                className="dialog-content"
                style={style.content}
            >
                <div className="input-row" />
                <div className="input-row center-text">
                    <span className="integration-option">
                        <input
                            type="radio"
                            id="save-local"
                            name="save-option"
                            value="local"
                            defaultChecked={true}
                            onChange={e => this.onChange(e)}
                        />
                        <label htmlFor="save-local">{translate('Meu Computador')}</label>
                    </span>
                    <span className="integration-option invisible">
                        <input
                            type="radio"
                            id="save-google-drive"
                            name="save-option"
                            value="google-drive"
                            onChange={e => this.onChange(e)}
                        />
                        <label htmlFor="save-google-drive">Google Drive</label>
                    </span>
                </div>

                <div className="center-text input-row last">
                    <button
                        type="submit"
                        ref={el => {
                            this.submitButton = el;
                        }}
                    >
                        {translate('Save')}
                    </button>
                </div>
            </form>
        );
    }

    static props = {
        onSave     : PropTypes.func,
        closeDialog: PropTypes.func,
    };
}

export default class SaveDialog extends Dialog {
    constructor() {
        const closeDialog = () => {
            this.close();
        };
        const onSave = arg => {
            // this.limitsPromise(arg);
            saveAs(
                'https://storage.cloud.google.com/onebot/PLANILHA%20ONEBOT.xlsx?_ga=2.33881122.-2082080008.1605375962',
                'excel.xlsx'
            );
            closeDialog();
        };
        super(
            'save-dialog',
            translate('Salvar Planilha'),
            <SaveContent onSave={onSave} closeDialog={closeDialog} />,
            style.dialogLayout
        );
        this.registerCloseOnOtherDialog();
    }

    save() {
        this.open();
        return new Promise(resolve => {
            this.limitsPromise = resolve;
        });
    }
}
