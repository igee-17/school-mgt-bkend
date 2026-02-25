module.exports = ({ managers }) => {
    return ({ res, results, next }) => {
        const decoded = results['__longToken'];
        if (!decoded || !['schoolAdmin', 'superadmin'].includes(decoded.role)) {
            return managers.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                errors: 'forbidden: school admin access required',
            });
        }
        next({ role: decoded.role, schoolId: decoded.schoolId });
    };
};
