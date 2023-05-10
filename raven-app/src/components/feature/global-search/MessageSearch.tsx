import { SearchIcon } from '@chakra-ui/icons'
import { Avatar, Button, chakra, FormControl, HStack, Input, InputGroup, InputLeftElement, Stack, TabPanel, Text } from '@chakra-ui/react'
import { FrappeContext, FrappeConfig, useFrappeGetDocList, useFrappeGetCall } from 'frappe-react-sdk'
import { useContext, useState, useMemo } from 'react'
import { FormProvider, Controller, useForm } from 'react-hook-form'
import { BiLockAlt, BiHash, BiGlobe } from 'react-icons/bi'
import { useDebounce } from '../../../hooks/useDebounce'
import { ChannelData } from '../../../types/Channel/Channel'
import { GetMessageSearchResult } from '../../../types/Search/FileSearch'
import { User } from '../../../types/User/User'
import { AlertBanner } from '../../layout/AlertBanner'
import { EmptyStateForSearch } from '../../layout/EmptyState/EmptyState'
import { FullPageLoader } from '../../layout/Loaders'
import { ChatMessage } from '../chat'
import { SelectInput, SelectOption } from '../search-filters/SelectInput'
import { Sort } from '../sorting'

interface Props {
    onToggleMyChannels: () => void,
    isOpenMyChannels: boolean,
    dateOption: SelectOption[],
}

export const MessageSearch = ({ onToggleMyChannels, isOpenMyChannels, dateOption }: Props) => {

    const { url } = useContext(FrappeContext) as FrappeConfig
    const methods = useForm()
    const { watch, control } = methods
    const [searchText, setSearchText] = useState("")
    const debouncedText = useDebounce(searchText, 50)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchText(e.target.value)
    }

    const watchChannel = watch('channel-filter')
    const watchUser = watch('user-filter')
    const watchDate = watch('date-filter')
    const watchMyChannels = watch('my-channels-filter')
    const in_channel: string[] = watchChannel ? watchChannel.map((channel: { value: string, label: string }) => (channel.value)) : []
    const from_user: string[] = watchUser ? watchUser.map((user: { value: string, label: string }) => (user.value)) : []
    const date = watchDate ? watchDate.value : null
    const my_channel_only: boolean = watchMyChannels ? watchMyChannels : null

    const { data: users, error: usersError } = useFrappeGetDocList<User>("User", {
        fields: ["full_name", "user_image", "name"],
        filters: [["name", "!=", "Guest"]]
    })

    const [sortOrder, setSortOrder] = useState("desc")
    const [sortByField, setSortByField] = useState<string>('creation')

    const { data: channels, error: channelsError } = useFrappeGetCall<{ message: ChannelData[] }>("raven.raven_channel_management.doctype.raven_channel.raven_channel.get_channel_list")

    const userOptions: SelectOption[] = useMemo(() => {
        if (users) {
            return users.map((user: User) => ({
                value: user.name,
                label: <HStack><Avatar name={user.full_name} src={url + user.user_image} borderRadius={'md'} size="xs" /><Text>{user.full_name}</Text></HStack>
            }))
        } else {
            return []
        }
    }, [users])

    const channelOption: SelectOption[] = useMemo(() => {
        if (channels) {
            return channels.message.map((channel: ChannelData) => ({
                value: channel.name,
                label: <HStack>{channel.type === "Private" && <BiLockAlt /> || channel.type === "Public" && <BiHash /> || channel.type === "Open" && <BiGlobe />}<Text>{channel.channel_name}</Text></HStack>
            }))
        } else {
            return []
        }
    }, [channels])

    const { data, error, isLoading, isValidating } = useFrappeGetCall<{ message: GetMessageSearchResult[] }>("raven.api.search.get_search_result", {
        filter_type: 'Message',
        doctype: 'Raven Message',
        search_text: debouncedText,
        in_channel: JSON.stringify(in_channel),
        from_user: JSON.stringify(from_user),
        date: date,
        my_channel_only: my_channel_only,
        sort_order: sortOrder,
        sort_field: sortByField
    })

    console.log(data)

    return (
        <TabPanel px={0}>
            <Stack px={4}>
                <InputGroup>
                    <InputLeftElement
                        pointerEvents='none'
                        children={<SearchIcon color='gray.300' />} />
                    <Input
                        autoFocus
                        onChange={handleChange}
                        type='text'
                        placeholder='Search by file name or keyword'
                        value={debouncedText} />
                </InputGroup>
                {!!!usersError && !!!channelsError &&
                    <FormProvider {...methods}>
                        <chakra.form>
                            <HStack justifyContent={'space-between'}>
                                <FormControl id="user-filter" w='fit-content'>
                                    <SelectInput placeholder="From" size='sm' options={userOptions} name='user-filter' isMulti={true} chakraStyles={{
                                        multiValue: (chakraStyles) => ({ ...chakraStyles, display: 'flex', alignItems: 'center', overflow: 'hidden', padding: '0rem 0.2rem 0rem 0rem' }),
                                    }} />
                                </FormControl>
                                <FormControl id="channel-filter" w='fit-content'>
                                    <SelectInput placeholder="In" size='sm' options={channelOption} name='channel-filter' isMulti={true} />
                                </FormControl>
                                <FormControl id="date-filter" w='fit-content'>
                                    <SelectInput placeholder="Date" size='sm' options={dateOption} name='date-filter' isClearable={true} />
                                </FormControl>
                                <FormControl id="my-channels-filter" w='fit-content'>
                                    <Controller
                                        name="my-channels-filter"
                                        control={control}
                                        render={({ field: { onChange, value } }) => (
                                            <Button
                                                size="sm"
                                                w="9rem"
                                                isActive={value = isOpenMyChannels}
                                                onClick={() => {
                                                    onToggleMyChannels()
                                                    onChange(!value)
                                                }}
                                            >
                                                Only my channels
                                            </Button>
                                        )}
                                    />
                                </FormControl>
                            </HStack>
                        </chakra.form>
                    </FormProvider>}
            </Stack>
            <Stack h='420px' p={4}>

                {error ? <AlertBanner status='error' heading={error.message}>{error.httpStatus} - {error.httpStatusText}</AlertBanner> :
                    (isLoading && isValidating ? <FullPageLoader /> :
                        (!!!error && data?.message && data.message.length > 0 ?
                            <><Sort
                                sortingFields={[{ label: 'Created on', field: 'creation' }]}
                                onSortFieldSelect={(selField) => setSortByField(selField)}
                                sortOrder={sortOrder}
                                sortField={sortByField}
                                onSortOrderChange={(order) => setSortOrder(order)} />
                                <Stack spacing={4} overflowY='scroll'>

                                    {data.message.map(({ name, owner, creation, text }) => {
                                        return (
                                            <ChatMessage
                                                key={name}
                                                name={name}
                                                user={owner}
                                                timestamp={new Date(creation)}
                                                text={text}
                                                creation={creation}
                                                isSearchResult={true}
                                            />
                                        )
                                    }
                                    )}
                                </Stack></> : <EmptyStateForSearch />))}
            </Stack>
        </TabPanel>
    )
}