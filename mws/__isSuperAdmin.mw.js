module.exports = ({ managers }) => {
    return ({ res, results, next }) => {
        const decoded = results['__longToken'];
        if (!decoded || decoded.role !== 'superadmin') {
            return managers.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                errors: 'forbidden: superadmin access required',
            });
        }
        next({ role: decoded.role });
    };
};
