import React from 'react';
import { translate } from '../../../common/i18n';

const RunButton = () => (
    <React.Fragment>
        <button title="Executar o bot" id="summaryRunButton" className="toolbox-button icon-play" />
        <button
            title={translate('Parar o bot')}
            id="summaryStopButton"
            className="toolbox-button icon-stop"
            style={{ display: 'none' }}
        />
    </React.Fragment>
);

export default RunButton;
