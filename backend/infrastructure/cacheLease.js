export const acquireLease = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
local fence = redis.call('INCR', KEYS[2])
redis.call('PEXPIRE', KEYS[2], ARGV[3])
redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2])
return fence`;
export const renewLease = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('PEXPIRE', KEYS[1], ARGV[2])
redis.call('PEXPIRE', KEYS[2], ARGV[3])
return 1`;
export const releaseLease = "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0";
export const writeWithLease = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
if tonumber(redis.call('GET', KEYS[2]) or '-1') ~= tonumber(ARGV[2]) then return 0 end
redis.call('SET', KEYS[3], ARGV[3], 'EX', ARGV[4])
return 1`;
